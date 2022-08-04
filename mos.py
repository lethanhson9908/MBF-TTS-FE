from dataclasses import replace
import os
from datetime import datetime

import requests, json
from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
import base64

app = Flask(__name__)

# /home/haunt32/ai-bigdata/backup/nlp-web


SECRET_KEY = os.urandom(12)
JWT_SECRET_KEY = os.urandom(12)
app.config['SECRET_KEY'] = SECRET_KEY
app.config['JWT_SECRET_KEY'] = JWT_SECRET_KEY

app.config['TEMPLATES_AUTO_RELOAD'] = True

jinja_options = app.jinja_options.copy()
jinja_options.update(dict(
    block_start_string='<%',
    block_end_string='%>',
    variable_start_string='{*',
    variable_end_string='*}',
    comment_start_string='<#',
    comment_end_string='#>'
))
app.jinja_options = jinja_options
app.jinja_env.auto_reload = True


def if_null_config(config, key, value):
    if key not in config:
        config[key] = value


try:
    config = {
        "UPLOAD_FOLDER": os.environ["UPLOAD_FOLDER"],
        "UPLOAD_FOLDER_STT_CONVERSATION": os.environ["UPLOAD_FOLDER_STT_CONVERSATION"],
        "URL_TTS": os.environ["URL_TTS"],
        "ULR_STT_VN": os.environ["ULR_STT_VN"],
        "ULR_STT_EN": os.environ["ULR_STT_EN"],
        "ULR_STT_CONVERSATION": os.environ["ULR_STT_CONVERSATION"],
    }
except:
    config = {}

if_null_config(config, "UPLOAD_FOLDER", "/home/ubuntu/BIGDATA_STT/tmp")
if_null_config(config, "UPLOAD_FOLDER_STT_CONVERSATION", "/home/ubuntu/BIGDATA_STT/tmp")
if_null_config(config, "URL_TTS", "http://0.0.0.0:8000/TTS")
if_null_config(config, "ULR_STT_VN", "http://10.38.23.47:8080/predict")
if_null_config(config, "ULR_STT_EN", "http://10.38.23.47:8080/engpredict")
if_null_config(config, "ULR_STT_CONVERSATION", "http://10.38.23.47:8080/cskh")


def root_dir():  # pragma: no cover
    return os.path.abspath(os.path.dirname(__file__))


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/mos')
def tts():
    return render_template('mos.html')


@app.route('/stt-conversation')
def stt_conversation():
    return render_template('stt-conversation.html')


@app.route('/convert-tts', methods=['POST'])
def convert_tts():
    url = config["URL_TTS"]
    data = {"text": request.json["text"]}
    response = requests.post(url, data=json.dumps(data))
    string_nhan_duoc = response.json()['audio_path']
    # string_nhan_duoc = test['audio_path']
    encode_string = string_nhan_duoc.encode('ascii')
    decode_string = base64.b64decode(encode_string)

    now = datetime.now()
    date_time = now.strftime("%m%d%Y%H%M%S")
    path = "{static}/sound/{file_name}.wav".format(static="static", file_name=date_time)

    complete_path = os.path.join(root_dir(), path)
    f = open(complete_path, "wb")
    f.write(decode_string)
    f.close()
    return jsonify(file="/" + path)


if __name__ == '__main__':
    app.run(host="0.0.0.0", debug=True, port=5000)
