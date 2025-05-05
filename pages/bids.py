import os
import pandas as pd
import streamlit as st
from ..utils import load_dataset

def main():
    st.title("All non-BIDS compliant files on lincbrain.org")

    df = load_dataset("lincbrain_assets.csv")

    st.dataframe(df[df['Subject']=='Unknown'])
