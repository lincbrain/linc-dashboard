import pandas as pd
import streamlit as st

@st.cache_data(ttl='1d')
def main():
    st.title("All non-BIDS compliant files on lincbrain.org")
    
    df = pd.read_csv('lincbrain_assets.csv')

    st.dataframe(df[df['Subject']=='Unknown'])
