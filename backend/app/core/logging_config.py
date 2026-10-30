
import logging
import logging.config


def setup_logging():
    logging_config = {
        "version": 1,
        "disable_existing_loggers": False,

        "formatters": {
            "standard": {
                "format": (
                    "%(asctime)s | "
                    "%(levelname)s | "
                    "%(name)s | "
                    "%(message)s"
                ),
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },

        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "standard",
                "level": "INFO",
            },
        },

        "root": {
            "handlers": ["console"],
            "level": "INFO",
        },
    }

    logging.config.dictConfig(logging_config)
