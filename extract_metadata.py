from dandi.dandiapi import DandiAPIClient
import pandas as pd
from pathlib import Path

modalities = {'oct': 'PS-OCT',
              'df': 'Dark field microscopy',
              'xpct': 'HiP-CT',
              'dwi': 'Diffusion MRI',
              'fluo': 'Light sheet microscopy',
              'photo': 'Blockface photo'}

# Create dataframe of all assets across all datasets
def extract_assets():
    client = DandiAPIClient("https://api.lincbrain.org/api")
    client.dandi_authenticate()
    dandisets = client.get_dandisets()

    print(f"Processing {sum(1 for _ in dandisets)} Datasets on lincbrain.org")

    df = pd.DataFrame(columns=["Dataset",
                            "Version",
                            "Subject", 
                            "Modality",
                            "Path",
                            "Filename",
                            "Extension",
                            "Directory", # Top-level directory (e.g. source data, raw data, derivatives)
                            'Size (bytes)'])

    for dataset in dandisets:
        latest_dataset = dataset.for_version('draft')
        if latest_dataset.identifier not in ['000048', '000004']: # Exclude OpenBNB dataset and mouse LSM dataset
            for asset in latest_dataset.get_assets():
                asset_split = asset.path.split('/')

                print(f"Dataset: {latest_dataset}; Asset: {asset_split[-1]:<80}", end='\r')

                metadata = asset.get_metadata()
                metadata_dict = metadata.model_dump(mode='json', exclude_none=True)

                subject = 'Unknown'
                for part in asset_split:
                    if part.startswith("sub-"):
                        subject = part.split("sub-")[1].split('_')[0]
                        break

                if subject == 'Unknown' and any(filename in asset_split[-1].lower() for filename in ['dataset_description.json', 'participants.tsv', 'readme.md', 'samples.tsv']):
                    subject = 'n/a'

                modality = next((value for key, value in modalities.items() 
                                if key in asset_split[-1].lower()), 
                                'Unknown')

                suffix = Path(asset.path).suffixes[0][1:] if Path(asset.path).suffixes else ''

                df.loc[len(df)] = [latest_dataset.identifier,
                                    latest_dataset.version.identifier,
                                    subject,
                                    modality,
                                    asset.path, 
                                    asset_split[-1],
                                    suffix,
                                    asset_split[0],
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
