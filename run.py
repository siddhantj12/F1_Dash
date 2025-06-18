import asyncio
import tkinter as tk
import sys
import os
import threading

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.gui.dashboard import F1Dashboard

def run_tk(root, app):
    """Run the Tkinter event loop in the main thread"""
    try:
        while True:
            root.update()
            root.update_idletasks()
            # Short sleep to reduce CPU usage
            threading.Event().wait(0.05)
    except tk.TclError as e:
        if "application has been destroyed" not in str(e):
            raise

def main():
    root = tk.Tk()
    app = F1Dashboard(root)
    
    # Run Tkinter in the main thread
    run_tk(root, app)

if __name__ == "__main__":
    main()