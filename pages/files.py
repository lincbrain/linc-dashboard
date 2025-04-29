import os
import pandas as pd
import streamlit as st

@st.cache_data(ttl='1d')
def main():
    st.title("Browse and search all files on lincbrain.org")

    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")

    df = pd.read_csv(
        f"s3://linc-dashboard/lincbrain_assets.csv",
        storage_options={
            "key": AWS_ACCESS_KEY_ID,
            "secret": AWS_SECRET_ACCESS_KEY,
        },
    )

    st.dataframe(df)
