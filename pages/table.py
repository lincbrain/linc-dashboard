import pandas as pd
import streamlit as st

def main():
    st.title("Browse and search all files on lincbrain.org")
    
    df = pd.read_csv('lincbrain_assets.csv')

    st.dataframe(df)
