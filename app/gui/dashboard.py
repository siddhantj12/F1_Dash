import asyncio
import threading

# Then add this method to your F1Dashboard class
def run_async(self, coro):
    """Run an async function from the synchronous Tkinter environment"""
    loop = asyncio.new_event_loop()
    
    def run_in_thread():
        asyncio.set_event_loop(loop)
        loop.run_until_complete(coro)
        loop.close()
    
    # Run the coroutine in a separate thread
    thread = threading.Thread(target=run_in_thread)
    thread.daemon = True
    thread.start()
    return thread

# Then modify your refresh_display method
def refresh_display(self):
    """Refresh the current telemetry display."""
    try:
        # Get current selections
        driver1 = self.driver1_var.get()
        driver2 = self.driver2_var.get()
        lap_number = float(self.lap_var.get())
        
        # Clear existing plot
        if hasattr(self, 'canvas'):
            self.canvas.get_tk_widget().destroy()
        
        # Run the async method in a separate thread
        self.run_async(self.analyze_telemetry(driver1, driver2, lap_number))
        
        # Update status
        self.status_var.set("Display refreshed successfully")
        
    except Exception as e:
        logging.error(f"Error refreshing display: {str(e)}")
        self.status_var.set(f"Error refreshing: {str(e)}")
        print(traceback.format_exc())