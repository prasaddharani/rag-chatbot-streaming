# Set base image (host OS)
FROM python:3.12

# By default, listen on port 5000
EXPOSE 5000/tcp

# Set the working directory in the container
WORKDIR /app

# Copy the dependencies file to the working directory
COPY requirements.txt /app/

# Install any dependencies
RUN pip install -r requirements.txt

RUN pip install PyMuPDF
RUN pip install frontend
RUN pip install tools
RUN pip install scikit-learn
RUN pip install flask-cors

# Copy the content of the local src directory to the working directory
# COPY cacert.pem /usr/local/lib/python3.12/site-packages/certifi/cacert.pem
# ENV SSL_CERT_FILE=/usr/local/lib/python3.12/site-packages/certifi/cacert.pem
COPY . /app/


# Specify the command to run on container start
CMD ["flask", "run", "--host=0.0.0.0"]