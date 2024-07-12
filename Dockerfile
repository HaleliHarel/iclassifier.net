FROM alpine:3.14

RUN apk add --no-cache python3 py3-pip
RUN pip install flask flask_login WTForms gunicorn openpyxl

RUN addgroup -S appgroup && adduser -S iclassifier -G appgroup
USER iclassifier
ENV HOME /home/iclassifier

#COPY data/auth $HOME/data/auth
COPY src/* $HOME/src/
COPY src/templates/* $HOME/src/templates/

#EXPOSE 8080

WORKDIR $HOME/src
CMD ["gunicorn", "-b", "0.0.0.0:8000", "app:app"]
