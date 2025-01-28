from pathlib import Path
from dandi.dandiapi import DandiAPIClient
import pandas as pd
import streamlit as st

client = DandiAPIClient("https://api.lincbrain.org/api")
client.dandi_authenticate()

df_dandisets = pd.DataFrame(columns=["Dandiset"])
df_assets = pd.DataFrame(columns=["Dandiset", "Subject", "File extension", "File name", "Full Path"])

for dandiset in client.get_dandisets():
    latest_dandiset = dandiset.for_version('draft')
    df_dandisets.loc[len(df_dandisets)] = [dandiset.identifier]

    for asset in latest_dandiset.get_assets():
        metadata = asset.get_metadata()
        metadata_dict = metadata.json_dict()
        asset_path = metadata_dict.get('path')

        if metadata_dict.get('wasAttributedTo') is not None and len(metadata_dict.get('wasAttributedTo')) > 0:
            subject = metadata_dict.get('wasAttributedTo')[0]['identifier']
        else:
            subject = ''

        df_assets.loc[len(df_assets)] = [dandiset.identifier, subject, ''.join(Path(asset_path).suffixes), Path(asset_path).name, asset_path]
            

st.title('LINC Datasets')
st.dataframe(df_dandisets)
st.dataframe(df_assets)