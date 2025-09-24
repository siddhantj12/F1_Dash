import logging
import sys

def setup_logging():
    logger = logging.getLogger("f1_dash")
    logger.setLevel(logging.INFO)

    # Create console handler with a higher log level
    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(logging.INFO)

    # Create formatter and add it to the handlers
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    ch.setFormatter(formatter)

    # Add the handlers to the logger
    if not logger.handlers: # Avoid adding multiple handlers if called multiple times
        logger.addHandler(ch)

    return logger

# Initialize logger
logger = setup_logging()
