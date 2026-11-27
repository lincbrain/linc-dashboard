import math
import os
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from fnmatch import fnmatch
from functools import lru_cache
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# BIDS suffix -> modality, matched case-insensitively in the file name, in order
modalities = {'oct': 'PS-OCT',
              'df': 'Dark-field microscopy',
              'xpct': 'HiP-CT',
              'dwi': 'Diffusion MRI',
              'spim': 'Light-sheet microscopy',
              'photo': 'Blockface photo'}

# Not validated (as by the BIDS validator); raw data may be under rawdata/
BIDS_UNVALIDATED_FOLDERS = ('derivatives', 'sourcedata', 'code')
BIDS_RAW_FOLDER = 'rawdata/'
BIDS_VALID = 'Valid'
BIDS_INVALID = 'Invalid'
BIDS_NOT_VALIDATED = 'Not validated'

UNKNOWN = 'Unknown'
NOT_APPLICABLE = 'n/a'

# See curation/README.md
MAPPINGS_CSV = './curation/mappings.csv'
UNMAPPED_CSV = './curation/unmapped.csv'
SAMPLES_CSV = './curation/samples.csv'
UNMAPPED_FOLDER_DEPTH = 3

# Keyed by dataset identifier prefix, e.g. LINC:000003
ARCHIVES = {
    'LINC': {
        'api_url': 'https://api.lincbrain.org/api',
        'token_env': 'LINC_API_KEY',
        'token_required': True,
        # OpenBNB and Mouse LSM
        'exclude': ['000048', '000004'],
    },
    'DANDI': {
        'api_url': 'https://api.dandiarchive.org/api',
        'token_env': 'DANDI_API_KEY',
        'token_required': False,
        # Inaccessible (e.g. embargoed) datasets are skipped
        'include': ['001278', '001372', '001411', '001412', '001769', '002048'],
    },
}

VERSION = 'draft'

ASSETS_CSV = './static/lincbrain_assets.csv'

OME_ZARR = 'OME-Zarr'
# Note for archives named .ome.zarr whose Zarr metadata has no OME-Zarr part
MISSING_OME_METADATA = 'Missing OME-Zarr metadata: add multiscales to the root group'
# Notes for derivatives that cannot be validated as BIDS-Derivatives datasets
NOT_IN_PIPELINE_FOLDER = 'Not in a pipeline folder: move to derivatives/<pipeline>/'
MISSING_DERIVATIVES_DESCRIPTION = 'Missing derivatives description: add dataset_description.json to its pipeline folder'
# Note for source data whose subject is not given by its folder
NOT_IN_SUBJECT_FOLDER = 'Not in a subject folder: move to sourcedata/sub-<label>/'
NOTE_SEPARATOR = '; '

# GitHub rejects files over 100 MB
MAX_CSV_BYTES = 95_000_000

PAGE_SIZE = 1000
# Concurrent requests
PAGE_WORKERS = 8
METADATA_WORKERS = 16
ZARR_WORKERS = 16

DATASET_LEVEL_FILES = {'dataset_description.json', 'participants.tsv', 'participants.json',
                       'samples.tsv', 'samples.json', 'readme', 'readme.md', 'readme.txt',
                       'changes', '.bidsignore'}


def retrying_session(backoff_factor, pool_size):
    session = requests.Session()
    retries = Retry(total=5, backoff_factor=backoff_factor, status_forcelist=[429, 500, 502, 503, 504])
    session.mount('https://', HTTPAdapter(max_retries=retries, pool_maxsize=pool_size))
    return session


class ArchiveClient:
    """DANDI API client (lincbrain.org runs the same API)."""

    def __init__(self, api_url, token=None):
        self.api_url = api_url
        self.session = retrying_session(2, max(PAGE_WORKERS, METADATA_WORKERS, ZARR_WORKERS))
        if token:
            self.session.headers['Authorization'] = f'token {token}'

    def check_token(self, token_env):
        # Otherwise an invalid key looks like inaccessible datasets
        response = self.session.get(f'{self.api_url}/auth/token/', timeout=120)
        if response.status_code in (401, 403):
            raise RuntimeError(f'{token_env} is not a valid API key for {self.api_url}')
        response.raise_for_status()

    def get(self, path, params=None):
        """An API path, or a full URL such as a page's next link."""
        url = path if path.startswith('https://') else f'{self.api_url}{path}'
        response = self.session.get(url, params=params, timeout=120)
        response.raise_for_status()
        return response.json()

    def paginate(self, path, params=None):
        params = {'page_size': PAGE_SIZE, **(params or {})}
        first = self.get(path, params)
        yield from first['results']
        next_url = first.get('next')
        if not next_url:
            return

        if 'count' in first and parse_qs(urlparse(next_url).query).get('page') == ['2']:
            # Fetch the other pages concurrently
            page_count = math.ceil(first['count'] / len(first['results']))
            with ThreadPoolExecutor(max_workers=PAGE_WORKERS) as executor:
                pages = executor.map(lambda number: self.get(path, {**params, 'page': number}),
                                     range(2, page_count + 1))
                for page in pages:
                    yield from page['results']
            return

        while next_url:
            page = self.get(next_url)
            yield from page['results']
            next_url = page['next']


class StorageReader:
    """Reads small files from an archive's storage."""

    def __init__(self, client):
        self.client = client
        # Never sends the API key to the storage
        self.storage = retrying_session(1, ZARR_WORKERS)

    def read_json(self, zarr_id, storage_url, name):
        """A Zarr archive's JSON file, or None if missing."""
        if storage_url:
            response = self.storage.get(storage_url + name, timeout=60)
            if response.status_code == 200:
                return response.json()
            if response.status_code == 404:
                return None
            if response.status_code != 403:
                response.raise_for_status()
        # Private storage: through the API, which redirects to a signed URL
        response = self.client.session.get(f'{self.client.api_url}/zarr/{zarr_id}/files/',
                                           params={'prefix': name, 'download': 'true'}, timeout=60)
        if response.status_code in (403, 404):
            return None
        response.raise_for_status()
        return response.json()

    def read_text(self, asset_id, storage_url):
        """An asset's content as text."""
        if storage_url:
            response = self.storage.get(storage_url, timeout=60)
            if response.status_code != 403:
                response.raise_for_status()
                return response.text
        response = self.client.session.get(f'{self.client.api_url}/assets/{asset_id}/download/', timeout=60)
        response.raise_for_status()
        return response.text


class BidsValidator:
    """Checks file paths against the BIDS schema."""

    def __init__(self):
        import bidsschematools.rules
        import bidsschematools.schema  # noqa: F401 (used by regexify_all)
        regexes, schema = bidsschematools.rules.regexify_all()
        self.patterns = [re.compile(entry['regex']) for entry in regexes]
        # e.g. micr -> OCT -> .ome.zarr/
        self.extensions = {}
        self._collect_extensions(schema.rules.files.raw)

    def _collect_extensions(self, group):
        for rule in group.values():
            if 'suffixes' in rule:
                for datatype in rule.get('datatypes', []):
                    for suffix in rule['suffixes']:
                        self.extensions.setdefault(datatype, {}).setdefault(suffix, set()).update(
                            rule.get('extensions', []))
            elif hasattr(rule, 'values'):
                self._collect_extensions(rule)

    def status(self, path, is_directory=False, root='', ignore=()):
        """Validate a dataset path whose BIDS data is under `root`."""
        parts = path.split('/')
        if (parts[0] in BIDS_UNVALIDATED_FOLDERS or any(part.startswith('.') for part in parts)
                or is_bidsignored(path, ignore)):
            return BIDS_NOT_VALIDATED
        path = path.removeprefix(root)
        # OME-Zarr archives are folders
        target = f'{path}/' if is_directory else path
        return BIDS_VALID if any(pattern.match(target) for pattern in self.patterns) else BIDS_INVALID

    def issue(self, path, is_directory=False, root=''):
        """Why an invalid path is not valid BIDS."""
        parts = path.removeprefix(root).split('/')
        if len(parts) == 1:
            return 'Not a BIDS file at the top level'
        if not re.fullmatch(r'sub-[0-9a-zA-Z+]+', parts[0]):
            return f'Not in a sub-<label> folder ({parts[0]}/)'
        first = 2 if len(parts) > 2 and re.fullmatch(r'ses-[0-9a-zA-Z+]+', parts[1]) else 1
        if len(parts) - first < 2:
            return 'Not in a datatype folder (e.g. micr/ or dwi/)'
        datatype = parts[first]
        if datatype not in self.extensions:
            return f'"{datatype}" is not a BIDS datatype folder'
        if len(parts) - first > 2:
            return f'In a subfolder of {datatype}/'
        name = parts[-1]
        if not name.startswith(f'{parts[0]}_'):
            return f'File name does not start with {parts[0]}_'
        stem, dot, extension = name.partition('.')
        suffix = stem.rsplit('_', 1)[-1]
        if suffix not in self.extensions[datatype]:
            return f'"{suffix}" is not a BIDS suffix for {datatype}/'
        if f'{dot}{extension}{"/" if is_directory else ""}' not in self.extensions[datatype][suffix]:
            return f'{dot}{extension} files are not allowed for {suffix}'
        return 'Entities do not follow BIDS'


@lru_cache(maxsize=1)
def bids_validator():
    return BidsValidator()


def parse_bidsignore(text):
    return [line.strip() for line in text.splitlines() if line.strip() and not line.strip().startswith('#')]


def is_bidsignored(path, patterns):
    """Whether a path matches .bidsignore patterns."""
    parts = path.split('/')
    folders_and_path = ['/'.join(parts[:i]) for i in range(1, len(parts) + 1)]
    for pattern in patterns:
        anchored = pattern.startswith('/') or '/' in pattern.strip('/')
        pattern = pattern.strip('/')
        candidates = folders_and_path if anchored else parts
        if any(fnmatch(candidate, pattern) for candidate in candidates):
            return True
    return False


def add_note(row, note):
    notes = row['Note'].split(NOTE_SEPARATOR) if row['Note'] else []
    if note not in notes:
        row['Note'] = NOTE_SEPARATOR.join(notes + [note])


def add_folder_notes(rows):
    """Note a dataset's derivatives that are not in derivatives/<pipeline>/ with a dataset_description.json,
    and its source data that is not in sourcedata/sub-<label>/."""
    described = {row['Path'].split('/')[1] for row in rows
                 if re.fullmatch(r'derivatives/[^/]+/dataset_description\.json', row['Path'])}
    for row in rows:
        parts = row['Path'].split('/')
        if len(parts) < 2:
            continue
        if parts[0] == 'derivatives':
            if parts[1].startswith('sub-'):
                add_note(row, NOT_IN_PIPELINE_FOLDER)
            elif len(parts) > 2 and parts[1] not in described:
                add_note(row, MISSING_DERIVATIVES_DESCRIPTION)
        elif parts[0] == 'sourcedata' and not (len(parts) > 2 and parts[1].startswith('sub-')):
            # e.g. sourcedata/README is about the folder, not a subject
            if len(parts) > 2 or parts[1].lower() not in DATASET_LEVEL_FILES:
                add_note(row, NOT_IN_SUBJECT_FOLDER)


def add_bids_status(rows, assets, metadatas, reader):
    """Set the BIDS status of a dataset's files."""
    ignore = []
    for asset, metadata in zip(assets, metadatas):
        if asset['path'] == '.bidsignore':
            try:
                ignore = parse_bidsignore(reader.read_text(asset['asset_id'], storage_url(metadata)))
            except requests.RequestException as error:
                warn(f"Could not read {asset['path']}: {error}")
    root = BIDS_RAW_FOLDER if any(asset['path'].startswith(BIDS_RAW_FOLDER) for asset in assets) else ''
    validator = bids_validator()
    for row, asset in zip(rows, assets):
        is_directory = bool(asset.get('zarr')) or asset['path'].endswith('.zarr')
        row['BIDS'] = validator.status(asset['path'], is_directory, root, ignore)
        row['BIDS issue'] = validator.issue(asset['path'], is_directory, root) if row['BIDS'] == BIDS_INVALID else ''


def ngff_version(attributes):
    """The OME-NGFF version in a Zarr group's attributes."""
    ome = attributes.get('ome')
    if isinstance(ome, dict) and ome.get('version'):
        return str(ome['version'])  # 0.5 and later
    # 0.4 and earlier
    for group in (attributes, ome if isinstance(ome, dict) else {}):
        multiscales = group.get('multiscales')
        if isinstance(multiscales, list) and multiscales and isinstance(multiscales[0], dict):
            if multiscales[0].get('version'):
                return str(multiscales[0]['version'])
        for key in ('plate', 'well'):
            if isinstance(group.get(key), dict) and group[key].get('version'):
                return str(group[key]['version'])
    return None


def ome_zarr_version(reader, zarr_id, storage_url):
    """An OME-Zarr archive's version, '' if it has no OME-Zarr metadata, or None if unreadable."""
    # zarr.json: Zarr v3; .zattrs: Zarr v2
    for name in ('zarr.json', '.zattrs'):
        document = reader.read_json(zarr_id, storage_url, name)
        if document is None:
            continue
        attributes = document.get('attributes', {}) if name == 'zarr.json' else document
        version = ngff_version(attributes)
        if version is None and 'bioformats2raw.layout' in {**attributes, **(attributes.get('ome') or {})}:
            series = reader.read_json(zarr_id, storage_url, f'0/{name}')
            if series is not None:
                version = ngff_version(series.get('attributes', {}) if name == 'zarr.json' else series)
        return version or ''
    return None


def storage_url(metadata):
    """The asset's storage (not API) URL."""
    return next((url for url in metadata.get('contentUrl') or [] if '/api/' not in url), None)


def add_ome_zarr_versions(archive, reader, rows, cache):
    """e.g. "OME-Zarr" -> "OME-Zarr v0.5"."""
    zarrs = [row for row in rows if row['Extension'] == OME_ZARR and row['_zarr']]
    pending = []
    for row in zarrs:
        cached = cache.get((row['Archive'], row['Dataset'], row['Path'], row['Uploaded']))
        if cached:
            row['Extension'] = cached
        else:
            pending.append(row)

    def read(row):
        try:
            return ome_zarr_version(reader, row['_zarr'], row['_storage'])
        except (requests.RequestException, ValueError):
            return None

    with ThreadPoolExecutor(max_workers=ZARR_WORKERS) as executor:
        versions = list(executor.map(read, pending))

    for row, version in zip(pending, versions):
        if version:
            row['Extension'] = f'{OME_ZARR} v{version}'
        elif version == '':
            add_note(row, MISSING_OME_METADATA)

    missing = versions.count('')
    unknown = versions.count(None)
    print(f'{archive}: {len(zarrs)} OME-Zarr archives; read {len(pending)} (the others are unchanged '
          f'since the previous run): {missing} without OME-Zarr metadata, {unknown} unreadable', flush=True)
    if unknown:
        warn(f'{archive}: {unknown} OME-Zarr archives could not be read')


def read_strings(path, **options):
    """A CSV's values as strings, or None if there is no such file."""
    return pd.read_csv(path, dtype=str, keep_default_na=False, **options) if os.path.exists(path) else None


def load_cache(path=ASSETS_CSV):
    """The previous run's OME-Zarr extensions."""
    previous = read_strings(path, usecols=['Archive', 'Dataset', 'Path', 'Extension', 'Uploaded'])
    if previous is None:
        return {}
    previous = previous[previous['Extension'].str.startswith(f'{OME_ZARR} v')]
    return {(row.Archive, row.Dataset, row.Path, row.Uploaded): row.Extension
            for row in previous.itertuples() if row.Uploaded}


def warn(message):
    print(f'::warning::{message}')


def is_access_error(error):
    return error.response is not None and error.response.status_code in (401, 403, 404)


def bids_label(name, entity, separators='_'):
    """The label of a BIDS entity in a name, e.g. MR256 for sub-MR256_photo.tif; labels are alphanumeric."""
    match = re.search(rf'(?:^|[{separators}]){entity}-([A-Za-z0-9]+)', name)
    return match.group(1) if match else None


def parse_subject(path):
    parts = path.split('/')

    # e.g. rawdata/sub-MR256/...
    for part in parts[:-1]:
        if part.startswith('sub-') and '_' not in part and len(part) > len('sub-'):
            return part[len('sub-'):]

    # e.g. sub-MF284-sample-slice036_... gives MF284
    for part in parts:
        label = bids_label(part, 'sub')
        if label:
            return label

    if parts[-1].lower() in DATASET_LEVEL_FILES:
        return NOT_APPLICABLE

    return UNKNOWN


def parse_sample(path):
    """The BIDS sample- label of the file name, or else of the nearest folder."""
    parts = path.split('/')
    # Folders such as sub-MF284-sample-slice079 also separate entities with -
    labels = [bids_label(parts[-1], 'sample')] + [bids_label(part, 'sample', '_-') for part in reversed(parts[:-1])]
    return next((label for label in labels if label), '')


def parse_stain(path):
    """The BIDS stain- label of the file name."""
    return bids_label(path.split('/')[-1], 'stain') or ''


def parse_modality(path):
    filename = path.split('/')[-1].lower()
    return next((value for key, value in modalities.items() if key in filename), UNKNOWN)


COMPRESSION_SUFFIXES = {'.gz', '.bz2', '.xz', '.zst'}


def parse_extension(path):
    """The last suffix, with the one before for compressed files: nii.gz for x.Img1.nii.gz."""
    if path.lower().endswith('.ome.zarr'):
        return OME_ZARR
    suffixes = Path(path).suffixes
    if len(suffixes) > 1 and suffixes[-1].lower() in COMPRESSION_SUFFIXES:
        return ''.join(suffixes[-2:])[1:]
    return suffixes[-1][1:] if suffixes else ''


def to_utc_date(value):
    """ISO 8601 timestamp -> UTC date."""
    if not value:
        return ''
    try:
        timestamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        return ''
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    return timestamp.astimezone(timezone.utc).strftime('%Y-%m-%d')


def asset_metadata(client, identifier, asset):
    if 'metadata' in asset:
        return asset['metadata']
    return client.get(f'/dandisets/{identifier}/versions/{VERSION}/assets/{asset["asset_id"]}/')


def dataset_name(dandiset):
    return (dandiset.get('draft_version') or {}).get('name', '')


def list_datasets(archive, client, config):
    """{identifier: name} of the datasets to index."""
    if 'include' in config:
        datasets = {}
        for identifier in config['include']:
            try:
                dandiset = client.get(f'/dandisets/{identifier}/')
            except requests.HTTPError as error:
                if not is_access_error(error):
                    raise
                warn(f'Skipping {archive}:{identifier}: {error}')
                continue
            datasets[identifier] = dataset_name(dandiset)
        return datasets

    return {dandiset['identifier']: dataset_name(dandiset)
            for dandiset in client.paginate('/dandisets/')
            if dandiset['identifier'] not in config['exclude']}


def extract_assets(archive, client, config, cache=None):
    datasets = list_datasets(archive, client, config)
    reader = StorageReader(client)

    latest_assets = []
    for identifier in sorted(datasets):
        try:
            assets = list(client.paginate(f'/dandisets/{identifier}/versions/{VERSION}/assets/',
                                          {'order': 'path', 'metadata': 'true'}))
        except requests.HTTPError as error:
            if not is_access_error(error):
                raise
            warn(f'Skipping {archive}:{identifier}: {error}')
            del datasets[identifier]
            continue

        # Listed twice if the dataset changed meanwhile
        assets = list({asset['asset_id']: asset for asset in assets}.values())
        print(f'{archive}:{identifier}: {len(assets)} assets', flush=True)
        if assets and 'metadata' not in assets[0]:
            print(f'{archive}:{identifier}: fetching metadata for each asset', flush=True)
        with ThreadPoolExecutor(max_workers=METADATA_WORKERS) as executor:
            metadatas = list(executor.map(lambda asset: asset_metadata(client, identifier, asset), assets))

        first_row = len(latest_assets)
        for asset, metadata in zip(assets, metadatas):
            latest_assets.append({
                "Archive": archive,
                "Dataset": identifier,
                "Version": VERSION,
                "Subject": parse_subject(asset['path']),
                "Sample": parse_sample(asset['path']),
                "Stain": parse_stain(asset['path']),
                "Modality": parse_modality(asset['path']),
                "Size (bytes)": asset['size'],
                "Path": asset['path'],
                "Extension": parse_extension(asset['path']),
                # The file's modification time
                "Produced": to_utc_date(metadata.get('blobDateModified')),
                "Uploaded": to_utc_date(metadata.get('dateModified') or asset.get('created')),
                "BIDS": '',
                "BIDS issue": '',
                "Note": '',
                "_zarr": asset.get('zarr'),
                "_storage": storage_url(metadata),
            })
        add_bids_status(latest_assets[first_row:], assets, metadatas, reader)
        add_folder_notes(latest_assets[first_row:])

    add_ome_zarr_versions(archive, reader, latest_assets, cache or {})
    for row in latest_assets:
        del row['_zarr'], row['_storage']

    names = pd.DataFrame([{"Archive": archive, "Dataset": identifier, "Name": name}
                          for identifier, name in datasets.items()])
    return pd.DataFrame(latest_assets), names


def gigabytes(sizes):
    return round(sizes.sum() / 1000**3, 2)


def join_unique(values):
    return ','.join(values.unique())


def earliest(values):
    values = values[values != '']
    return values.min() if len(values) else ''


def latest(values):
    values = values[values != '']
    return values.max() if len(values) else ''


def sample_keys(df):
    """Each file's sample as subject/label, or empty."""
    return (df['Subject'] + '/' + df['Sample']).where(df['Sample'] != '', '')


def count_samples(keys):
    return keys[keys != ''].nunique()


def summarize_datasets(df, df_names):
    df_datasets = (df.assign(_sample=sample_keys(df))
                     .groupby(['Archive', 'Dataset'], sort=False)
                     .agg(**{"Modality": ("Modality", join_unique),
                             "Size (GB)": ("Size (bytes)", gigabytes),
                             "Subject": ("Subject", join_unique),
                             "Samples": ("_sample", count_samples),
                             "Extension": ("Extension", join_unique),
                             "First uploaded": ("Uploaded", earliest),
                             "Last uploaded": ("Uploaded", latest)})
                     .reset_index())
    df_datasets = df_datasets.merge(df_names, on=['Archive', 'Dataset'], how='left')
    return df_datasets[["Archive", "Dataset", "Name", "Modality", "Size (GB)", "Subject", "Samples",
                        "Extension", "First uploaded", "Last uploaded"]]


def load_mappings(path=MAPPINGS_CSV):
    """Curated mappings, most specific folders first."""
    mappings = read_strings(path)
    if mappings is None:
        return []
    mappings = mappings.to_dict('records')
    known = set(modalities.values())
    for mapping in mappings:
        mapping['Folder'] = mapping['Folder'].strip('/')
        if mapping['Modality'] and mapping['Modality'] not in known:
            warn(f"{path}: unknown modality {mapping['Modality']!r} for {mapping['Folder']}")
    return sorted(mappings, key=lambda mapping: -len(mapping['Folder']))


def apply_mappings(df, mappings):
    """Fill unknown modalities and subjects from the mappings, and add their notes."""
    records = df.to_dict('records')
    for record in records:
        for mapping in mappings:
            if (mapping['Archive'], mapping['Dataset']) != (record['Archive'], record['Dataset']):
                continue
            if mapping['Folder'] and not record['Path'].startswith(mapping['Folder'] + '/'):
                continue
            applied = not (mapping['Modality'] or mapping['Subject'])
            for field in ('Modality', 'Subject'):
                if mapping[field] and record[field] == UNKNOWN:
                    record[field] = mapping[field]
                    applied = True
            if applied and mapping['Note']:
                add_note(record, mapping['Note'])
    return pd.DataFrame(records, columns=df.columns)


def load_sample_names(path=SAMPLES_CSV):
    """{(archive, dataset, subject or '', label): name}"""
    rows = read_strings(path)
    if rows is None:
        return {}
    return {(row['Archive'], row['Dataset'], row['Subject'], row['Sample']): row['Same as']
            for row in rows.to_dict('records')}


def apply_sample_names(df, names):
    """Rename samples as listed in curation/samples.csv."""
    def rename(archive, dataset, subject, sample):
        if not sample:
            return sample
        return names.get((archive, dataset, subject, sample)) or names.get((archive, dataset, '', sample)) or sample

    return df.assign(Sample=[rename(*key) for key in zip(df['Archive'], df['Dataset'], df['Subject'], df['Sample'])])


def summarize_unmapped(df, depth=UNMAPPED_FOLDER_DEPTH):
    """Folders with files of unknown modality or subject."""
    unknown = df[(df['Modality'] == UNKNOWN) | (df['Subject'] == UNKNOWN)]
    folders = unknown['Path'].map(lambda path: '/'.join(path.split('/')[:-1][:depth]))
    return (unknown.assign(Folder=folders)
                   .groupby(['Archive', 'Dataset', 'Folder'])
                   .agg(**{"Files": ("Path", "size"),
                           "Size (GB)": ("Size (bytes)", gigabytes),
                           "Unknown modality": ("Modality", lambda values: int((values == UNKNOWN).sum())),
                           "Unknown subject": ("Subject", lambda values: int((values == UNKNOWN).sum())),
                           "Example": ("Path", "first")})
                   .reset_index())


def write_csvs(df, df_names, directory='./static', unmapped_path=UNMAPPED_CSV):
    path = f'{directory}/lincbrain_assets.csv'
    df.to_csv(path, index=False)
    size = os.path.getsize(path)
    print(f'{path}: {len(df)} files, {size / 1e6:.1f} MB', flush=True)
    if size > MAX_CSV_BYTES:
        raise RuntimeError(f'{path} is {size / 1e6:.0f} MB, too large to commit to GitHub')
    summarize_datasets(df, df_names).to_csv(f'{directory}/lincbrain_datasets.csv', index=False)
    summarize_unmapped(df).to_csv(unmapped_path, index=False)


if __name__ == "__main__":
    cache = load_cache()
    assets, names = [], []
    for archive, config in ARCHIVES.items():
        token = os.environ.get(config['token_env'])
        if config['token_required'] and not token:
            raise RuntimeError(f"{config['token_env']} environment variable not set")

        client = ArchiveClient(config['api_url'], token)
        if token:
            client.check_token(config['token_env'])
        df_archive, df_archive_names = extract_assets(archive, client, config, cache)
        assets.append(df_archive)
        names.append(df_archive_names)

    df = apply_mappings(pd.concat(assets, ignore_index=True), load_mappings())
    df = apply_sample_names(df, load_sample_names())
    write_csvs(df, pd.concat(names, ignore_index=True))
