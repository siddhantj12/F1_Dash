import uvicorn


def main():
    """Run the FastAPI app locally (no Tkinter)."""
    uvicorn.run("src.main:app", host="127.0.0.1", port=8000, reload=True)


if __name__ == "__main__":
    main()