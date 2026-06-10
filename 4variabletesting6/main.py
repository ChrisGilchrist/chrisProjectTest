# import the Quix Streams modules for interacting with Kafka.
# For general info, see https://quix.io/docs/quix-streams/introduction.html
from quixstreams import Application

import os

# for local dev, load env vars from a .env file
from dotenv import load_dotenv
load_dotenv()


def main():
    """
    Transformations generally read from, and produce to, Kafka topics.

    They are conducted with Applications and their accompanying StreamingDataFrames
    which define what transformations to perform on incoming data.

    Be sure to explicitly produce output to any desired topic(s); it does not happen
    automatically!

    To learn about what operations are possible, the best place to start is:
    https://quix.io/docs/quix-streams/processing.html
    """

    # Log variable group values at startup
    print("[Variable Group: INFLUXDB_CONNECTION]")
    print(f"  INFLUXDB_HOST = {os.environ.get('INFLUXDB_HOST', 'not set')}")
    print(f"  INFLUXDB_PORT = {os.environ.get('INFLUXDB_PORT', 'not set')}")
    print(  "  INFLUXDB_TOKEN = ***")

    print("[Variable Group: QA S1 Group]")
    print(f"  S3_PLAIN_VAR = {os.environ.get('S3_PLAIN_VAR', 'not set')}")
    print(  "  S3_SECRET_VAR = ***")

    # Setup necessary objects
    app = Application(
        consumer_group="my_transformation",
        auto_create_topics=True,
        auto_offset_reset="earliest"
    )
    input_topic = app.topic(name=os.environ["input"])
    output_topic = app.topic(name=os.environ["output"])
    sdf = app.dataframe(topic=input_topic)

    # Do StreamingDataFrame operations/transformations here
    sdf = sdf.apply(lambda row: row).filter(lambda row: True)
    sdf = sdf.print(metadata=True)

    # Finish off by writing to the final result to the output topic
    sdf.to_topic(output_topic)

    # With our pipeline defined, now run the Application
    app.run()


# It is recommended to execute Applications under a conditional main
if __name__ == "__main__":
    main()
