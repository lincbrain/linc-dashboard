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
        print(df_dandisets)
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

            # df_assets.loc[len(df_assets)] = [dandiset.identifier, subject, ''.join(Path(asset_path).suffixes), Path(asset_path).name, asset_path]
                
            j=j+1
            if j==2:
                break

    return df_dandisets

def main():
    st.title("LINC Data Summary Site")
    st.write("This is meant to share information across the LINC project investigators.  Data is indexed daily.  If your data is not listed here it is likely that it does not adhere to the BIDS specification and the file names will need to be changed.")

    df_dandisets = index_files()
    print(df_dandisets)
    print(df_dandisets['Dandiset'].unique())
    tabs = st.tabs(["All Dandisets"] + list(df_dandisets['Dandiset'].unique()))

    with tabs[0]:
        st.title("Summary of data modalities acquired")
        st.dataframe(df_dandisets)
    with tabs[1]:
        st.header("Test1")
    with tabs[2]:
        st.header("Test2")
