"""
Script huấn luyện mô hình recommendation
Sử dụng Collaborative Filtering và Content-Based Filtering
"""

import pymongo
import pandas as pd
import numpy as np
from surprise import Dataset, Reader, SVD, KNNBasic, accuracy
from surprise.model_selection import train_test_split, cross_validate
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import pickle
import os
from datetime import datetime

# Kết nối MongoDB
client = pymongo.MongoClient("mongodb://localhost:27017/")
db = client["movie_recommendation"]
movies_collection = db["movies"]
click_history_collection = db["clickhistories"]
ratings_collection = db["ratings"]

def load_data_for_training():
    """Load dữ liệu từ MongoDB để huấn luyện"""
    print("Đang load dữ liệu từ MongoDB...")
    
    # Load click history
    clicks = list(click_history_collection.find({}).limit(10000))
    
    if len(clicks) == 0:
        print("Không có dữ liệu click history, tạo dữ liệu giả lập...")
        return create_synthetic_data()
    
    # Chuyển đổi sang DataFrame
    data = []
    for click in clicks:
        data.append({
            'userId': str(click.get('userId', '')),
            'movieId': str(click.get('movieId', '')),
            'rating': 3.5 + np.random.random() * 1.5  # Giả lập rating từ click
        })
    
    df = pd.DataFrame(data)
    print(f"Đã load {len(df)} interactions")
    
    return df

def create_synthetic_data():
    """Tạo dữ liệu giả lập để huấn luyện"""
    print("Tạo dữ liệu giả lập...")
    
    # Lấy tất cả movies và users
    movies = list(movies_collection.find({}).limit(100))
    users = list(range(1, 201))  # 200 users giả lập
    
    if len(movies) == 0:
        print("Không có movies trong database!")
        return None
    
    data = []
    for user_id in users:
        # Mỗi user xem 10-50 movies ngẫu nhiên
        num_movies = np.random.randint(10, 51)
        selected_movies = np.random.choice(range(len(movies)), num_movies, replace=False)
        
        for movie_idx in selected_movies:
            movie = movies[movie_idx]
            rating = np.random.normal(3.5, 1.0)
            rating = np.clip(rating, 1.0, 5.0)
            
            data.append({
                'userId': str(user_id),
                'movieId': str(movie['_id']),
                'rating': rating
            })
    
    df = pd.DataFrame(data)
    print(f"Đã tạo {len(df)} interactions giả lập")
    return df

def train_collaborative_filtering(df):
    """Huấn luyện Collaborative Filtering model"""
    print("\n=== Huấn luyện Collaborative Filtering ===")
    
    # Chuẩn bị dữ liệu cho Surprise
    reader = Reader(rating_scale=(1, 5))
    data = Dataset.load_from_df(df[['userId', 'movieId', 'rating']], reader)
    
    # Chia train/test
    trainset, testset = train_test_split(data, test_size=0.2, random_state=42)
    
    # Huấn luyện SVD model
    print("Đang huấn luyện SVD model...")
    algo_svd = SVD(n_factors=50, n_epochs=20, lr_all=0.005, reg_all=0.02)
    algo_svd.fit(trainset)
    
    # Đánh giá trên test set
    predictions = algo_svd.test(testset)
    
    rmse = accuracy.rmse(predictions)
    mae = accuracy.mae(predictions)
    
    print(f"RMSE: {rmse:.4f}")
    print(f"MAE: {mae:.4f}")
    
    # Cross-validation
    print("\nĐang thực hiện cross-validation...")
    cv_results = cross_validate(algo_svd, data, measures=['RMSE', 'MAE'], cv=3, verbose=True)
    
    # Lưu model
    os.makedirs('models', exist_ok=True)
    with open('models/collaborative_filtering_svd.pkl', 'wb') as f:
        pickle.dump(algo_svd, f)
    
    print("Đã lưu model: models/collaborative_filtering_svd.pkl")
    
    return algo_svd, {'rmse': rmse, 'mae': mae, 'cv_rmse': cv_results['test_rmse'].mean()}

def train_content_based(df):
    """Huấn luyện Content-Based model"""
    print("\n=== Huấn luyện Content-Based Filtering ===")
    
    # Load movies
    movies = list(movies_collection.find({}))
    movies_df = pd.DataFrame(movies)
    
    if len(movies_df) == 0:
        print("Không có movies để huấn luyện!")
        return None, None
    
    # Tạo feature từ genres, tags, description
    movies_df['features'] = movies_df.apply(lambda x: 
        ' '.join(x.get('genres', [])) + ' ' + 
        ' '.join(x.get('tags', [])) + ' ' + 
        str(x.get('description', '')), axis=1)
    
    # TF-IDF Vectorization
    print("Đang tạo TF-IDF vectors...")
    tfidf = TfidfVectorizer(max_features=1000, stop_words='english')
    tfidf_matrix = tfidf.fit_transform(movies_df['features'])
    
    # Tính cosine similarity
    print("Đang tính cosine similarity...")
    similarity_matrix = cosine_similarity(tfidf_matrix)
    
    # Lưu model
    os.makedirs('models', exist_ok=True)
    with open('models/content_based_tfidf.pkl', 'wb') as f:
        pickle.dump(tfidf, f)
    
    with open('models/content_based_similarity.pkl', 'wb') as f:
        pickle.dump(similarity_matrix, f)
    
    # Lưu movie index mapping
    movie_index_map = {str(movie['_id']): idx for idx, movie in enumerate(movies)}
    with open('models/movie_index_map.pkl', 'wb') as f:
        pickle.dump(movie_index_map, f)
    
    print("Đã lưu content-based model")
    
    return similarity_matrix, movie_index_map

def evaluate_model(df, model, model_type='collaborative'):
    """Đánh giá mô hình"""
    print(f"\n=== Đánh giá {model_type} model ===")
    
    if model_type == 'collaborative':
        # Đánh giá collaborative filtering
        reader = Reader(rating_scale=(1, 5))
        data = Dataset.load_from_df(df[['userId', 'movieId', 'rating']], reader)
        trainset, testset = train_test_split(data, test_size=0.2, random_state=42)
        
        predictions = model.test(testset)
        
        rmse = accuracy.rmse(predictions, verbose=False)
        mae = accuracy.mae(predictions, verbose=False)
        
        # Precision@K và Recall@K
        k = 10
        precision_k, recall_k = calculate_precision_recall_at_k(predictions, k)
        
        metrics = {
            'RMSE': rmse,
            'MAE': mae,
            f'Precision@{k}': precision_k,
            f'Recall@{k}': recall_k
        }
    else:
        # Đánh giá content-based
        metrics = {
            'Note': 'Content-based evaluation requires user feedback loop'
        }
    
    return metrics

def calculate_precision_recall_at_k(predictions, k=10):
    """Tính Precision@K và Recall@K"""
    # Nhóm predictions theo user
    user_preds = {}
    for uid, iid, true_r, est, _ in predictions:
        if uid not in user_preds:
            user_preds[uid] = []
        user_preds[uid].append((iid, true_r, est))
    
    precisions = []
    recalls = []
    
    for uid, user_ratings in user_preds.items():
        # Sắp xếp theo predicted rating
        user_ratings.sort(key=lambda x: x[2], reverse=True)
        
        # Top K recommendations
        top_k = user_ratings[:k]
        
        # Relevant items (rating >= 4)
        relevant_items = sum(1 for _, true_r, _ in user_ratings if true_r >= 4)
        
        if relevant_items == 0:
            continue
        
        # Recommended và relevant
        recommended_and_relevant = sum(1 for _, true_r, _ in top_k if true_r >= 4)
        
        precision = recommended_and_relevant / k if k > 0 else 0
        recall = recommended_and_relevant / relevant_items if relevant_items > 0 else 0
        
        precisions.append(precision)
        recalls.append(recall)
    
    avg_precision = np.mean(precisions) if precisions else 0
    avg_recall = np.mean(recalls) if recalls else 0
    
    return avg_precision, avg_recall

def save_evaluation_results(metrics_cf, metrics_cb):
    """Lưu kết quả đánh giá"""
    os.makedirs('models', exist_ok=True)
    
    results = {
        'timestamp': datetime.now().isoformat(),
        'collaborative_filtering': metrics_cf,
        'content_based': metrics_cb
    }
    
    import json
    with open('models/evaluation_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print("\nĐã lưu kết quả đánh giá: models/evaluation_results.json")

def main():
    """Hàm chính"""
    print("=" * 50)
    print("BẮT ĐẦU HUẤN LUYỆN MÔ HÌNH")
    print("=" * 50)
    
    # Load dữ liệu
    df = load_data_for_training()
    
    if df is None or len(df) == 0:
        print("Không có dữ liệu để huấn luyện!")
        return
    
    # Huấn luyện models
    cf_model, cf_metrics = train_collaborative_filtering(df)
    cb_similarity, cb_index_map = train_content_based(df)
    
    # Đánh giá
    metrics_cf = evaluate_model(df, cf_model, 'collaborative')
    metrics_cb = evaluate_model(df, None, 'content-based')
    
    # Lưu kết quả
    save_evaluation_results(metrics_cf, metrics_cb)
    
    print("\n" + "=" * 50)
    print("HOÀN THÀNH HUẤN LUYỆN MÔ HÌNH")
    print("=" * 50)
    
    print("\nKết quả đánh giá Collaborative Filtering:")
    for key, value in metrics_cf.items():
        print(f"  {key}: {value:.4f}")

if __name__ == "__main__":
    main()

