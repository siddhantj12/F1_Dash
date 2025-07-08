import streamlit as st
import requests

API_URL = "http://localhost:8000/api"  # Change to your deployed API URL if needed

st.title("F1 Dash")

# Fetch available seasons from FastAPI backend
st.header("Available Seasons")
try:
    resp = requests.get(f"{API_URL}/seasons")
    seasons = resp.json()
    season = st.selectbox("Select a season", seasons)
    st.write(f"You selected: {season}")
except Exception as e:
    st.error(f"Could not fetch seasons: {e}")

# You can add more UI to fetch races, telemetry, etc. from your API 