"""
Module đánh giá mô hình recommendation
Tính RMSE, MAE, Precision@K, Recall@K
"""

import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error

class ModelEvaluator:
    def __init__(self):
        pass
    
    def calculate_rmse(self, y_true, y_pred):
        """Tính Root Mean Squared Error"""
        return np.sqrt(mean_squared_error(y_true, y_pred))
    
    def calculate_mae(self, y_true, y_pred):
        """Tính Mean Absolute Error"""
        return mean_absolute_error(y_true, y_pred)
    
    def calculate_precision_at_k(self, recommendations, relevant_items, k):
        """Tính Precision@K"""
        if len(recommendations) == 0:
            return 0.0
        
        top_k = recommendations[:k]
        relevant_recommended = len(set(top_k) & set(relevant_items))
        
        return relevant_recommended / min(k, len(recommendations))
    
    def calculate_recall_at_k(self, recommendations, relevant_items, k):
        """Tính Recall@K"""
        if len(relevant_items) == 0:
            return 0.0
        
        top_k = recommendations[:k]
        relevant_recommended = len(set(top_k) & set(relevant_items))
        
        return relevant_recommended / len(relevant_items)
    
    def evaluate_recommendations(self, user_recommendations, user_relevant_items, k=10):
        """Đánh giá recommendations cho một user"""
        precision = self.calculate_precision_at_k(
            user_recommendations, 
            user_relevant_items, 
            k
        )
        recall = self.calculate_recall_at_k(
            user_recommendations, 
            user_relevant_items, 
            k
        )
        
        return {
            f'precision@{k}': precision,
            f'recall@{k}': recall
        }
    
    def evaluate_all_users(self, all_recommendations, all_relevant_items, k=10):
        """Đánh giá recommendations cho tất cả users"""
        precisions = []
        recalls = []
        
        for user_id in all_recommendations.keys():
            if user_id in all_relevant_items:
                metrics = self.evaluate_recommendations(
                    all_recommendations[user_id],
                    all_relevant_items[user_id],
                    k
                )
                precisions.append(metrics[f'precision@{k}'])
                recalls.append(metrics[f'recall@{k}'])
        
        return {
            f'mean_precision@{k}': np.mean(precisions) if precisions else 0.0,
            f'mean_recall@{k}': np.mean(recalls) if recalls else 0.0,
            f'std_precision@{k}': np.std(precisions) if precisions else 0.0,
            f'std_recall@{k}': np.std(recalls) if recalls else 0.0
        }

