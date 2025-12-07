"""
Script xử lý và làm sạch dữ liệu phim
Thực hiện: Missing values, Chuẩn hóa, Loại bỏ duplicate, Vector hóa
"""

import pymongo
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import StandardScaler
import re
import json
from datetime import datetime

# Kết nối MongoDB
client = pymongo.MongoClient("mongodb://localhost:27017/")
db = client["movie_recommendation"]
movies_collection = db["movies"]

def load_movies_from_db():
    """Load movies from MongoDB"""
    print("Đang load dữ liệu từ MongoDB...")
    movies = list(movies_collection.find({}))
    print(f"Đã load {len(movies)} movies từ database")
    return pd.DataFrame(movies)

def clean_missing_values(df):
    """Xử lý missing values"""
    print("\n=== Xử lý Missing Values ===")
    
    # Thống kê missing values trước khi xử lý
    print("Missing values trước khi xử lý:")
    print(df.isnull().sum())
    
    # Điền giá trị mặc định cho các trường
    df['description'] = df['description'].fillna('No description available')
    df['director'] = df['director'].fillna('Unknown')
    df['country'] = df['country'].fillna('Unknown')
    df['language'] = df['language'].fillna('English')
    df['year'] = df['year'].fillna(df['year'].median() if not df['year'].isna().all() else 2000)
    df['duration'] = df['duration'].fillna(df['duration'].median() if not df['duration'].isna().all() else 120)
    df['rating'] = df['rating'].fillna(df['rating'].median() if not df['rating'].isna().all() else 5.0)
    df['genres'] = df['genres'].apply(lambda x: x if isinstance(x, list) and len(x) > 0 else ['Unknown'])
    df['cast'] = df['cast'].apply(lambda x: x if isinstance(x, list) and len(x) > 0 else [])
    df['tags'] = df['tags'].apply(lambda x: x if isinstance(x, list) and len(x) > 0 else [])
    
    # Đảm bảo các số là float/int
    df['year'] = pd.to_numeric(df['year'], errors='coerce').fillna(2000).astype(int)
    df['duration'] = pd.to_numeric(df['duration'], errors='coerce').fillna(120).astype(int)
    df['rating'] = pd.to_numeric(df['rating'], errors='coerce').fillna(5.0).astype(float)
    df['views'] = pd.to_numeric(df['views'], errors='coerce').fillna(0).astype(int)
    df['clickCount'] = pd.to_numeric(df['clickCount'], errors='coerce').fillna(0).astype(int)
    
    print("\nMissing values sau khi xử lý:")
    print(df.isnull().sum().sum(), "missing values còn lại")
    
    return df

def remove_duplicates(df):
    """Loại bỏ duplicate movies"""
    print("\n=== Loại bỏ Duplicates ===")
    
    initial_count = len(df)
    print(f"Số lượng movies ban đầu: {initial_count}")
    
    # Loại bỏ duplicate dựa trên title và year
    df = df.drop_duplicates(subset=['title', 'year'], keep='first')
    
    # Hoặc dựa trên sourceUrl nếu có
    df = df.drop_duplicates(subset=['sourceUrl'], keep='first')
    
    final_count = len(df)
    removed = initial_count - final_count
    print(f"Số lượng movies sau khi loại bỏ: {final_count}")
    print(f"Đã loại bỏ {removed} duplicates")
    
    return df

def normalize_data(df):
    """Chuẩn hóa dữ liệu"""
    print("\n=== Chuẩn hóa Dữ liệu ===")
    
    # Chuẩn hóa text (title, description)
    df['title'] = df['title'].str.strip()
    df['description'] = df['description'].str.strip()
    
    # Chuẩn hóa rating về thang điểm 0-10
    df['rating'] = df['rating'].clip(0, 10)
    
    # Chuẩn hóa year (loại bỏ năm không hợp lệ)
    current_year = datetime.now().year
    df['year'] = df['year'].clip(1900, current_year + 1)
    
    # Chuẩn hóa duration (loại bỏ thời lượng không hợp lệ)
    df['duration'] = df['duration'].clip(1, 600)  # Từ 1 phút đến 10 giờ
    
    # Chuẩn hóa genres (chuyển về title case)
    df['genres'] = df['genres'].apply(
        lambda x: [genre.strip().title() for genre in x if genre.strip()] if isinstance(x, list) else []
    )
    
    # Chuẩn hóa country, language (title case)
    df['country'] = df['country'].str.title()
    df['language'] = df['language'].str.title()
    
    print("Đã chuẩn hóa dữ liệu")
    
    return df

def handle_outliers(df):
    """Xử lý outliers"""
    print("\n=== Xử lý Outliers ===")
    
    # Xử lý outliers cho rating
    Q1 = df['rating'].quantile(0.25)
    Q3 = df['rating'].quantile(0.75)
    IQR = Q3 - Q1
    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR
    
    outliers_rating = ((df['rating'] < lower_bound) | (df['rating'] > upper_bound)).sum()
    print(f"Phát hiện {outliers_rating} outliers trong rating")
    
    # Có thể giữ lại outliers hoặc capping
    # df['rating'] = df['rating'].clip(lower_bound, upper_bound)
    
    # Xử lý outliers cho duration
    Q1_duration = df['duration'].quantile(0.25)
    Q3_duration = df['duration'].quantile(0.75)
    IQR_duration = Q3_duration - Q1_duration
    lower_bound_duration = max(1, Q1_duration - 1.5 * IQR_duration)
    upper_bound_duration = Q3_duration + 1.5 * IQR_duration
    
    outliers_duration = ((df['duration'] < lower_bound_duration) | (df['duration'] > upper_bound_duration)).sum()
    print(f"Phát hiện {outliers_duration} outliers trong duration")
    
    # Capping duration
    df['duration'] = df['duration'].clip(lower_bound_duration, upper_bound_duration)
    
    return df

def vectorize_text(df):
    """Vector hóa text sử dụng TF-IDF"""
    print("\n=== Vector hóa Text (TF-IDF) ===")
    
    # Tạo text từ title và description
    df['combined_text'] = df['title'] + ' ' + df['description']
    
    # Vectorize sử dụng TF-IDF
    vectorizer = TfidfVectorizer(
        max_features=100,
        stop_words='english',
        ngram_range=(1, 2),
        min_df=2
    )
    
    try:
        tfidf_matrix = vectorizer.fit_transform(df['combined_text'])
        feature_names = vectorizer.get_feature_names_out()
        
        print(f"Đã tạo TF-IDF matrix với {tfidf_matrix.shape[0]} documents và {tfidf_matrix.shape[1]} features")
        
        # Lưu vectorizer để sử dụng sau
        import pickle
        with open('data/processed/tfidf_vectorizer.pkl', 'wb') as f:
            pickle.dump(vectorizer, f)
        
        # Lưu TF-IDF matrix (sparse matrix)
        import scipy.sparse
        scipy.sparse.save_npz('data/processed/tfidf_matrix.npz', tfidf_matrix)
        
        # Lưu feature names
        with open('data/processed/tfidf_features.json', 'w') as f:
            json.dump(feature_names.tolist(), f)
            
    except Exception as e:
        print(f"Lỗi khi vectorize: {e}")
    
    return df

def save_processed_data(df):
    """Lưu dữ liệu đã xử lý vào MongoDB"""
    print("\n=== Lưu dữ liệu đã xử lý ===")
    
    # Xóa dữ liệu cũ
    movies_collection.delete_many({})
    
    # Chuyển DataFrame thành dictionary và lưu
    movies_dict = df.to_dict('records')
    
    # Loại bỏ _id nếu có để tránh conflict
    for movie in movies_dict:
        if '_id' in movie:
            movie.pop('_id')
        # Loại bỏ combined_text (chỉ dùng cho vectorization)
        if 'combined_text' in movie:
            movie.pop('combined_text')
    
    # Insert vào MongoDB
    movies_collection.insert_many(movies_dict)
    
    print(f"Đã lưu {len(movies_dict)} movies vào MongoDB")

def main():
    """Hàm chính"""
    print("=" * 50)
    print("BẮT ĐẦU XỬ LÝ DỮ LIỆU")
    print("=" * 50)
    
    # Tạo thư mục nếu chưa có
    import os
    os.makedirs('data/processed', exist_ok=True)
    
    # Load dữ liệu
    df = load_movies_from_db()
    
    if len(df) == 0:
        print("Không có dữ liệu để xử lý!")
        return
    
    # Xử lý dữ liệu
    df = clean_missing_values(df)
    df = remove_duplicates(df)
    df = normalize_data(df)
    df = handle_outliers(df)
    df = vectorize_text(df)
    
    # Lưu dữ liệu đã xử lý
    save_processed_data(df)
    
    print("\n" + "=" * 50)
    print("HOÀN THÀNH XỬ LÝ DỮ LIỆU")
    print("=" * 50)
    print(f"Tổng số movies sau xử lý: {len(df)}")

if __name__ == "__main__":
    main()

