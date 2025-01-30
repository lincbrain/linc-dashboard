from pathlib import Path
from dandi.dandiapi import DandiAPIClient
import pandas as pd
import streamlit as st
import json

@st.cache_data(ttl='1d')
def index_files():
    client = DandiAPIClient("https://api.lincbrain.org/api")
    client.dandi_authenticate()

    df_dandisets = pd.DataFrame(columns=["Dandiset"])

    for dandiset in client.get_dandisets():
        latest_dandiset = dandiset.for_version('draft')
        df_dandisets.loc[len(df_dandisets)] = [dandiset.identifier]
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
                
            j=j+1
            if j==2:
                break

    return df_dandisets

def main():
    df_dandisets = index_files()

    st.title("Summary of data modalities acquired.")
    st.write("test")
    st.dataframe(df_dandisets)
