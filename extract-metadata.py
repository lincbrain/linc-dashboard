from dandi.dandiapi import DandiAPIClient
from dandi.dandiapi import RemoteDandiset
import numpy as np
import pandas as pd
from pathlib import Path

client = DandiAPIClient("https://api.lincbrain.org/api")
client.dandi_authenticate()

dandisets = []
for data in client.paginate("/dandisets/"):
    dandisets.append(RemoteDandiset.from_data(client, data))
print(f"Number of Dandisets: {len(dandisets)}")

df = pd.DataFrame(columns=["Dandiset",
                           "Version",
                           "Subject", 
                           "Modality",
                           "Path",
                           "Filename",
                           "Extension",
                           "Source/Raw/Derived Data",
                           'Size (bytes)'])

modalities = {'oct': 'PS-OCT',
                'df': 'Dark Field Microscopy',
                'xpct': 'HiP-CT',
                'dwi': 'DWI',
                'fluo': 'LSM'
                }

for dandiset in client.get_dandisets():
    latest_dandiset = dandiset.for_version('draft')
    for asset in latest_dandiset.get_assets():

        metadata = asset.get_metadata()
        metadata_dict = metadata.model_dump(mode='json', exclude_none=True)

        subject = 'Unknown'
        for part in asset.path.split('/'):
            if part.startswith("sub-"):
                subject = part.split("sub-")[1].split('_')[0]
                break

        modality = next((value for key, value in modalities.items() 
                         if key in asset.path.split('/')[-1].lower()), 
                         'Unknown')

        df.loc[len(df)] = [latest_dandiset.identifier,
                            latest_dandiset.version.identifier,
                            subject,
                            modality,
                            asset.path, 
                            asset.path.split('/')[-1],
                            ''.join(Path(asset.path).suffixes),
                            asset.path.split('/')[0],
                            metadata_dict['contentSize']]

# Summarize data across modalities
modalities['unknown'] = 'Unknown'

df_summary = pd.DataFrame(columns=["Modality",
                           "Size (GB)",
                           "Subjects", 
                           "Extensions"])

for key, value in modalities.items():
    df_summary.loc[len(df_summary)] = [value,
                       sum(df[(df['Modality'] == value)]['Size (bytes)'])/(1000**3),
                       df[(df['Modality'] == value)]['Subject'].unique(),
                       df[(df['Modality'] == value)]['Extension'].unique()]
