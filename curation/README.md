# Curation

`extract_metadata.py` works out each file's modality, subject and tissue
sample from its name (BIDS entities and suffixes). When a name does not give
the modality or subject, they are "Unknown". These files map such files to
curated values, merge samples whose label is spelled several ways, and list
the people who worked on the files, which file names do not give.

## `mappings.csv` (edited by hand)

One row per folder:

| Column | Meaning |
| --- | --- |
| `Archive` | `LINC` (lincbrain.org) or `DANDI` (dandiarchive.org) |
| `Dataset` | Dataset identifier, e.g. `001412` |
| `Folder` | Folder within the dataset; the mapping applies to every file under it. Empty for the whole dataset. |
| `Modality` | Modality for the folder's files of unknown modality, e.g. `Light-sheet microscopy` (see `modalities` in `extract_metadata.py`). Optional. |
| `Subject` | Subject for the folder's files of unknown subject. Optional. |
| `Note` | Shown on the dashboard for the files the mapping changes, e.g. `Needs renaming: add the _SPIM suffix`. Optional. A mapping with a note but no modality or subject adds the note to all of the folder's files. |

Mappings only replace "Unknown": a file whose name gives its modality or
subject keeps it. When several mappings match a file, the most specific folder
wins.

`extract_metadata.py` also adds notes itself, and a file can have several
(separated by `; `):

- `Missing OME-Zarr metadata: add multiscales to the root group`: OME-Zarr
  archives without OME-Zarr metadata, which viewers cannot open as images.
- `Not in a pipeline folder: move to derivatives/<pipeline>/`: derivatives
  under `derivatives/sub-<label>/` (or directly in `derivatives/`).
- `Missing derivatives description: add dataset_description.json to its
  pipeline folder`: derivatives in a `derivatives/<pipeline>/` folder that has
  no `dataset_description.json`.

- `Not in a subject folder: move to sourcedata/sub-<label>/`: source data
  outside a `sourcedata/sub-<label>/` folder.

The two derivatives notes are why derivatives cannot be validated as
BIDS-Derivatives datasets. Source data is not validated as BIDS: it holds the
data before conversion, in any format.

## `samples.csv` (edited by hand)

A file's sample is the BIDS `sample-<label>` entity of its name (or else of the
nearest folder name), e.g. `slice079` for `sub-MF284_sample-slice079_...`.
Labels are only unique within a subject. One row per label to rename:

| Column | Meaning |
| --- | --- |
| `Archive` | `LINC` (lincbrain.org) or `DANDI` (dandiarchive.org) |
| `Dataset` | Dataset identifier, e.g. `001278` |
| `Subject` | Subject of the sample. Empty for any subject of the dataset. |
| `Sample` | The label as it appears in file names, e.g. `lefthemi` |
| `Same as` | The label to show instead, e.g. `LeftHemi` |

For example, `sub-Hb1_sample-lefthemi_...` and `sub-Hb1_sample-LeftHemi_...`
are the same sample, so `lefthemi` is listed with `Same as` `LeftHemi`, and the
dashboard counts and filters them as one.

## `people.csv` (edited by hand)

Who stained the tissue, generated (acquired) the data, annotated it and
analyzed it. The dashboard can be filtered by person and role, and lists each
file's and dataset's people. One row per person and role:

| Column | Meaning |
| --- | --- |
| `Archive` | `LINC` (lincbrain.org) or `DANDI` (dandiarchive.org) |
| `Dataset` | Dataset identifier, e.g. `000003` |
| `Folder` | Folder within the dataset; the row applies to every file under it. Empty for the whole dataset. |
| `Subject` | Only the files of this subject, e.g. `MR256`. Optional. |
| `Sample` | Only the files of this sample (as shown on the dashboard, after `samples.csv`), e.g. `slice079`. Optional. |
| `Modality` | Only the files of this modality, e.g. `PS-OCT`. Optional. |
| `Stain` | Only the files with this BIDS `stain-` label, e.g. `LY`. Optional. |
| `Role` | `Staining`, `Generation`, `Annotation` or `Analysis` |
| `Person` | The person's name, as it should appear on the dashboard |

A row applies to the files that match all of its non-empty columns. For
example, `LINC,000003,,MR256,,,LY,Staining,Jane Doe` lists Jane Doe for the
staining of subject MR256's LY-stained files in LINC:000003, and
`DANDI,001412,derivatives/registration,,,,,Analysis,John Roe` lists John Roe
for the analysis of every file under that folder.

Rows add up: a file lists everyone whose rows match it, in the order of the
rows. Spell each name the same way in every row: the dashboard filters by the
exact name. `extract_metadata.py` warns about rows with an unknown role or
modality, and rows that match no files. It writes a column for each role to
`lincbrain_assets.csv`, with the people separated by `; `.

## `unmapped.csv` (generated)

Written by each run of `extract_metadata.py`: the folders (up to three levels
deep) that still have files of unknown modality or subject, with the number of
such files, their size and an example. Use it to find folders to add to
`mappings.csv`.
