from pathlib import Path
from dandi.dandiapi import DandiAPIClient
import pandas as pd
import streamlit as st
import json

def index_files():
    client = DandiAPIClient("https://api.lincbrain.org/api")
    client.dandi_authenticate()

    df_assets = pd.DataFrame(columns=["Dandiset", "Subject", "File extension", "File name", "Full Path"])

    for dandiset in client.get_dandisets():
        latest_dandiset = dandiset.for_version('draft')
        print(dandiset, latest_dandiset)
        j=0

        for asset in latest_dandiset.get_assets():
            metadata = asset.get_metadata()
            metadata_dict = metadata.json_dict()
            print(json.dumps(metadata_dict, indent=4))
            asset_path = metadata_dict.get('path')

            if metadata_dict.get('wasAttributedTo') is not None and len(metadata_dict.get('wasAttributedTo')) > 0:
                subject = metadata_dict.get('wasAttributedTo')[0]['identifier']
            else:
                subject = ''

            df_assets.loc[len(df_assets)] = [dandiset.identifier, subject, ''.join(Path(asset_path).suffixes), Path(asset_path).name, asset_path]
                
            j=j+1
            if j==20:
                break

    return df_assets

def main():
    df_assets = index_files()

    st.title("List of files on lincbrain.org")
    st.write("Browse and search through all files.")
    st.dataframe(df_assets)
