import secrets
import logging
import os

from quixstreams import Application

app = Application()

logging.basicConfig(level=logging.INFO)

key = secrets.token_bytes(64)
value = secrets.token_bytes(256)
value_size = len(value)

bytes_sent = 0
total_sent = 0
log_threshold = 5 * 1024 * 1024  # 5 MB
topic = app.topic(os.environ["output"])

with app.get_producer() as producer:
    for i in range(1000000):
        producer.produce(topic=topic.name, key=key, value=value)
        bytes_sent += value_size
        total_sent += value_size
        if bytes_sent >= log_threshold:
            logging.info(f"Total data sent: {total_sent / (1024 * 1024):.2f} MB")
            bytes_sent = 0
