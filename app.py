import streamlit as st
import importlib
from PIL import Image

im = Image.open("assets/favicon.ico")
st.set_page_config(
    page_title="LINC Dashboard",   
    page_icon=im,                  
    layout="wide", 
    initial_sidebar_state="expanded"
    )

st.markdown("""
    <style>
        [data-testid="stSidebarNav"] {
            display: none;
        }
    </style>
""", unsafe_allow_html=True)

st.sidebar.image("https://raw.githubusercontent.com/lincbrain/linc-artwork/refs/heads/main/linc.logo.color%2Bblack.alpha.png")

if st.sidebar.button("Summary", use_container_width=True):
    st.session_state["page"] = "Summary"
if st.sidebar.button("All files", use_container_width=True):
    st.session_state["page"] = "Files"
if st.sidebar.button("Non-BIDS compliant files", use_container_width=True):
    st.session_state["page"] = "BIDS"

if "page" not in st.session_state:
    st.session_state["page"] = "Summary"

def run_page(page_name):
    if page_name == "Summary":
        page = importlib.import_module("pages.home")
    elif page_name == "Files":
        page = importlib.import_module("pages.files")
    elif page_name == "BIDS":
        page = importlib.import_module("pages.bids")
    else:
        st.write("Page not found.")
        return
    page.main()

run_page(st.session_state["page"])
