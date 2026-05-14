from database import mongo
from flask import Flask
import os
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
app.config['MONGO_URI'] = os.getenv('MONGO_URI')
mongo.init_app(app)

with app.app_context():
    s = mongo.db.students.find_one()
    if s:
        print(f"Student keys: {list(s.keys())}")
    else:
        print("No students found")
