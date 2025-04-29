import pandas as pd
import streamlit as st

@st.cache_data(ttl='1d')
def main():
    st.title("Browse and search all files on lincbrain.org")
    
    df = pd.read_csv('lincbrain_assets.csv')

    st.dataframe(df)
