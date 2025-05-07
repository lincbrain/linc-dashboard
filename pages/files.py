import pandas as pd
import streamlit as st
from utils import load_dataset

def main():
    st.title("Browse and search all files on lincbrain.org")

    df = load_dataset("lincbrain_assets.csv")

    st.dataframe(df)
