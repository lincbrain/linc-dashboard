import pandas as pd
import streamlit as st

def main():
    st.title("List of files on lincbrain.org")
    st.write("Browse and search through all files.")
    
    df = pd.read_csv('lincbrain_assets.csv')
    st.dataframe(df)
