import os
import pandas as pd
import streamlit as st
import numpy as np
import plotly.express as px
from utils import load_dataset

def main():
    st.title("LINC Dashboard")
    st.write("Displayed is a summary of all data on lincbrain.org.  This dashboard is intended for the LINC project investigators.  Data is indexed daily.")

    # List summary of all datasets
    st.title("Datasets")

    df_datasets = load_dataset("lincbrain_datasets.csv")
    df_datasets_sorted = df_datasets.sort_values(by='Dataset')

    st.dataframe(df_datasets_sorted, hide_index=True, column_config={col: {'alignment':"left"} for col in df_datasets_sorted.columns})

    # Plot summary of all modalities
    st.title("Modalities")
    df_modalities = load_dataset("lincbrain_modalities.csv")
    df_modalities_sorted = df_modalities.sort_values(by='Modality')
    
    subjects_unique = list(set([value.strip() for item in df_modalities_sorted['Subject'] 
                                if isinstance(item, str) 
                                for value in item.split(',')]))

    grid_values = np.zeros((df_modalities_sorted['Modality'].nunique(),
                            len(subjects_unique)))

    for m, modality in enumerate(df_modalities_sorted['Modality'].unique()):
        for s, subject in enumerate(subjects_unique):
            
            subject_modality = list(set([value.strip() 
                                          for item in list(df_modalities_sorted[df_modalities_sorted['Modality'] == modality]['Subject']) 
                                if isinstance(item, str) 
                                for value in item.split(',')]))

            if subject in subject_modality:
                grid_values[m,s] = 1

    fig = px.imshow(grid_values, 
                    x=subjects_unique, 
                    y=df_modalities_sorted['Modality'].unique(), 
                    color_continuous_scale=['rgba(102,102,102,1)',
                                            'rgba(99,110,250,1)'])
    
    fig.update_layout(plot_bgcolor='rgba(0,0,0,0)', 
                      coloraxis_showscale=False, 
                      margin=dict(l=10, r=10, t=10, b=10),
                      xaxis_type='category')

    fig.update_traces(xgap=5, 
                      ygap=5)

    st.plotly_chart(fig, use_container_width=True)

    # List summary of all modalities
    st.dataframe(df_modalities_sorted, hide_index=True, column_config={col: {'alignment':"left"} for col in df_modalities_sorted.columns})
