from dandi.dandiapi import DandiAPIClient
from dandi.dandiapi import RemoteDandiset
import pandas as pd
from pathlib import Path

modalities = {'oct': 'PS-OCT',
              'df': 'Dark Field Microscopy',
              'xpct': 'HiP-CT',
              'dwi': 'DWI',
              'fluo': 'LSM',
              'photo': 'Blockface photo'}

# Create dataframe of all assets across all datasets
def extract_assets():
    client = DandiAPIClient("https://api.lincbrain.org/api")
    client.dandi_authenticate()

    print(f"Processing {sum(1 for _ in client.get_dandisets())} Dandisets on lincbrain.org")

    df = pd.DataFrame(columns=["Dandiset",
                            "Version",
                            "Subject", 
                            "Modality",
                            "Path",
                            "Filename",
                            "Extension",
                            "Directory", # Top-level directory (e.g. source data, raw data, derivatives)
                            'Size (bytes)'])

    for dandiset in client.get_dandisets():
        latest_dandiset = dandiset.for_version('draft')
        for asset in latest_dandiset.get_assets():
            print(f"Dandiset: {latest_dandiset}; Asset: {asset.path.split('/')[-1]:<40}", end='\r')

            metadata = asset.get_metadata()
            metadata_dict = metadata.model_dump(mode='json', exclude_none=True)

            subject = 'Unknown'
            for part in asset.path.split('/'):
                if part.startswith("sub-"):
                    subject = part.split("sub-")[1].split('_')[0]
                    break

            if subject == 'Unknown' and any(filename in asset.path.split('/')[-1].lower() for filename in ['dataset_description.json', 'participants.tsv', 'readme.md', 'samples.tsv']):
                subject = 'n/a'

            modality = next((value for key, value in modalities.items() 
                            if key in asset.path.split('/')[-1].lower()), 
                            'Unknown')

            suffix = Path(asset.path).suffixes[0][1:] if Path(asset.path).suffixes else ''

            df.loc[len(df)] = [latest_dandiset.identifier,
                                latest_dandiset.version.identifier,
                                subject,
                                modality,
                                asset.path, 
                                asset.path.split('/')[-1],
                                suffix,
                                asset.path.split('/')[0],
                                metadata_dict['contentSize']]

    return df

# Summarize data across modalities
def summarize_modalities(df):
    modalities['unknown'] = 'Unknown'

    df_summary = pd.DataFrame(columns=["Modality",
                                    "Size (GB)",
                                    "Subjects", 
                                    "Extensions"])

    for _, value in modalities.items():
        df_summary.loc[len(df_summary)] = [value,
                    round(sum(df[(df['Modality'] == value)]['Size (bytes)'])/(1000**3),2),
                    df[(df['Modality'] == value)]['Subject'].unique(),
                    df[(df['Modality'] == value)]['Extension'].unique()]
    
    return df_summary

if __name__ == "__main__":
    df = extract_assets()
    df_summary = summarize_modalities(df)
