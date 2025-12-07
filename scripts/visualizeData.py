"""
Script trực quan hóa dữ liệu phim
Thực hiện: Phân bố rating, Top movies, Heatmap, Bar chart, Histogram
"""

import pymongo
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import os
from datetime import datetime

# Cấu hình matplotlib cho tiếng Việt
plt.rcParams['font.family'] = 'DejaVu Sans'
sns.set_style("whitegrid")

# Kết nối MongoDB
client = pymongo.MongoClient("mongodb://localhost:27017/")
db = client["movie_recommendation"]
movies_collection = db["movies"]

def load_movies():
    """Load movies from MongoDB"""
    movies = list(movies_collection.find({}))
    return pd.DataFrame(movies)

def plot_rating_distribution(df):
    """Vẽ phân bố rating"""
    print("Đang vẽ phân bố rating...")
    
    plt.figure(figsize=(12, 6))
    
    # Histogram
    plt.subplot(1, 2, 1)
    plt.hist(df['rating'].dropna(), bins=30, edgecolor='black', alpha=0.7, color='skyblue')
    plt.xlabel('Rating')
    plt.ylabel('Số lượng phim')
    plt.title('Phân bố Rating của các bộ phim')
    plt.grid(True, alpha=0.3)
    
    # Box plot
    plt.subplot(1, 2, 2)
    plt.boxplot(df['rating'].dropna())
    plt.ylabel('Rating')
    plt.title('Box Plot của Rating')
    plt.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('data/visualizations/rating_distribution.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("Đã lưu: data/visualizations/rating_distribution.png")

def plot_top_movies(df, n=20):
    """Vẽ top N phim phổ biến"""
    print(f"Đang vẽ top {n} phim phổ biến...")
    
    # Top theo clickCount
    top_by_clicks = df.nlargest(n, 'clickCount')[['title', 'clickCount', 'rating']]
    
    plt.figure(figsize=(14, 8))
    plt.barh(range(len(top_by_clicks)), top_by_clicks['clickCount'], color='steelblue')
    plt.yticks(range(len(top_by_clicks)), top_by_clicks['title'], fontsize=10)
    plt.xlabel('Số lượt click')
    plt.title(f'Top {n} phim phổ biến nhất (theo số lượt click)')
    plt.gca().invert_yaxis()
    plt.grid(True, alpha=0.3, axis='x')
    plt.tight_layout()
    plt.savefig('data/visualizations/top_movies_by_clicks.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("Đã lưu: data/visualizations/top_movies_by_clicks.png")
    
    # Top theo rating
    top_by_rating = df.nlargest(n, 'rating')[['title', 'rating', 'clickCount']]
    
    plt.figure(figsize=(14, 8))
    plt.barh(range(len(top_by_rating)), top_by_rating['rating'], color='coral')
    plt.yticks(range(len(top_by_rating)), top_by_rating['title'], fontsize=10)
    plt.xlabel('Rating')
    plt.title(f'Top {n} phim có rating cao nhất')
    plt.gca().invert_yaxis()
    plt.grid(True, alpha=0.3, axis='x')
    plt.tight_layout()
    plt.savefig('data/visualizations/top_movies_by_rating.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("Đã lưu: data/visualizations/top_movies_by_rating.png")

def plot_genre_frequency(df):
    """Vẽ tần suất thể loại phim"""
    print("Đang vẽ tần suất thể loại...")
    
    # Đếm tần suất genres
    genre_count = {}
    for genres in df['genres']:
        if isinstance(genres, list):
            for genre in genres:
                genre_count[genre] = genre_count.get(genre, 0) + 1
    
    # Sắp xếp và lấy top 15
    genre_sorted = sorted(genre_count.items(), key=lambda x: x[1], reverse=True)[:15]
    genres, counts = zip(*genre_sorted)
    
    plt.figure(figsize=(14, 8))
    plt.barh(range(len(genres)), counts, color='mediumseagreen')
    plt.yticks(range(len(genres)), genres)
    plt.xlabel('Số lượng phim')
    plt.title('Top 15 thể loại phim phổ biến nhất')
    plt.gca().invert_yaxis()
    plt.grid(True, alpha=0.3, axis='x')
    plt.tight_layout()
    plt.savefig('data/visualizations/genre_frequency.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("Đã lưu: data/visualizations/genre_frequency.png")

def plot_year_distribution(df):
    """Vẽ phân bố năm phát hành"""
    print("Đang vẽ phân bố năm phát hành...")
    
    plt.figure(figsize=(14, 6))
    plt.hist(df['year'].dropna(), bins=30, edgecolor='black', alpha=0.7, color='plum')
    plt.xlabel('Năm phát hành')
    plt.ylabel('Số lượng phim')
    plt.title('Phân bố phim theo năm phát hành')
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig('data/visualizations/year_distribution.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("Đã lưu: data/visualizations/year_distribution.png")

def plot_heatmap(df):
    """Vẽ heatmap tương quan giữa các features"""
    print("Đang vẽ heatmap...")
    
    # Chọn các features số
    numeric_features = df[['rating', 'duration', 'year', 'clickCount', 'views']].select_dtypes(include=[np.number])
    
    # Tính correlation matrix
    corr_matrix = numeric_features.corr()
    
    plt.figure(figsize=(10, 8))
    sns.heatmap(corr_matrix, annot=True, fmt='.2f', cmap='coolwarm', center=0,
                square=True, linewidths=1, cbar_kws={"shrink": 0.8})
    plt.title('Heatmap tương quan giữa các features')
    plt.tight_layout()
    plt.savefig('data/visualizations/feature_heatmap.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("Đã lưu: data/visualizations/feature_heatmap.png")

def plot_genre_rating_heatmap(df):
    """Vẽ heatmap rating theo genre"""
    print("Đang vẽ heatmap rating theo genre...")
    
    # Tạo matrix genre x rating
    genre_ratings = {}
    for _, row in df.iterrows():
        if isinstance(row['genres'], list):
            for genre in row['genres']:
                if genre not in genre_ratings:
                    genre_ratings[genre] = []
                genre_ratings[genre].append(row['rating'])
    
    # Tính average rating cho mỗi genre
    genre_avg_rating = {genre: np.mean(ratings) for genre, ratings in genre_ratings.items() if len(ratings) > 0}
    
    # Lấy top 15 genres
    top_genres = sorted(genre_avg_rating.items(), key=lambda x: x[1], reverse=True)[:15]
    genres, avg_ratings = zip(*top_genres)
    
    plt.figure(figsize=(12, 8))
    plt.barh(range(len(genres)), avg_ratings, color='salmon')
    plt.yticks(range(len(genres)), genres)
    plt.xlabel('Average Rating')
    plt.title('Average Rating theo thể loại (Top 15)')
    plt.gca().invert_yaxis()
    plt.grid(True, alpha=0.3, axis='x')
    plt.tight_layout()
    plt.savefig('data/visualizations/genre_rating.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("Đã lưu: data/visualizations/genre_rating.png")

def generate_summary_statistics(df):
    """Tạo báo cáo thống kê tổng quan"""
    print("Đang tạo báo cáo thống kê...")
    
    stats = {
        'Tổng số phim': len(df),
        'Trung bình rating': df['rating'].mean(),
        'Trung bình duration (phút)': df['duration'].mean(),
        'Năm phát hành trung bình': df['year'].mean(),
        'Tổng số lượt click': df['clickCount'].sum(),
        'Trung bình lượt click/phim': df['clickCount'].mean(),
        'Số thể loại duy nhất': len(set([g for genres in df['genres'] if isinstance(genres, list) for g in genres]))
    }
    
    # Lưu vào file
    with open('data/visualizations/summary_statistics.txt', 'w', encoding='utf-8') as f:
        f.write("=" * 50 + "\n")
        f.write("BÁO CÁO THỐNG KÊ DỮ LIỆU PHIM\n")
        f.write("=" * 50 + "\n\n")
        for key, value in stats.items():
            f.write(f"{key}: {value:.2f}\n" if isinstance(value, float) else f"{key}: {value}\n")
    
    print("Đã lưu: data/visualizations/summary_statistics.txt")

def main():
    """Hàm chính"""
    print("=" * 50)
    print("BẮT ĐẦU TRỰC QUAN HÓA DỮ LIỆU")
    print("=" * 50)
    
    # Tạo thư mục
    os.makedirs('data/visualizations', exist_ok=True)
    
    # Load dữ liệu
    df = load_movies()
    
    if len(df) == 0:
        print("Không có dữ liệu để trực quan hóa!")
        return
    
    # Trực quan hóa
    plot_rating_distribution(df)
    plot_top_movies(df, 20)
    plot_genre_frequency(df)
    plot_year_distribution(df)
    plot_heatmap(df)
    plot_genre_rating_heatmap(df)
    generate_summary_statistics(df)
    
    print("\n" + "=" * 50)
    print("HOÀN THÀNH TRỰC QUAN HÓA DỮ LIỆU")
    print("=" * 50)
    print("Tất cả các biểu đồ đã được lưu trong: data/visualizations/")

if __name__ == "__main__":
    main()

