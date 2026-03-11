# ==========================================
# 1. МОДЕЛІ БАЗИ ДАНИХ (models.py)
# ==========================================
from django.db import models
from django.contrib.auth.models import User

class SocialPage(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    page_name = models.CharField(max_length=255)
    platform = models.CharField(max_length=50)
    page_id_platform = models.CharField(max_length=255)
    access_token = models.TextField()
    followers_count = models.IntegerField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)

class Post(models.Model):
    page = models.ForeignKey(SocialPage, on_delete=models.CASCADE)
    post_id_platform = models.CharField(max_length=255, unique=True)
    title = models.TextField(null=True, blank=True)
    created_time = models.DateTimeField()

class PostMetrics(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE)
    snapshot_date = models.DateField(auto_now_add=True)
    likes = models.IntegerField(default=0)
    comments = models.IntegerField(default=0)
    shares = models.IntegerField(default=0)
    reach = models.IntegerField(default=0)
    impressions = models.IntegerField(default=0)

# ==========================================
# 2. ФОНОВІ ЗАВДАННЯ ТА ІНТЕГРАЦІЯ (tasks.py)
# ==========================================
from celery import shared_task
import requests
from dateutil.parser import parse

@shared_task
def fetch_and_update_social_data():
    """Фонова задача для автоматичного збору даних через API (Facebook)"""
    pages = SocialPage.objects.filter(platform='Facebook')
    for page in pages:
        # Симуляція запиту до Graph API
        url = f"https://graph.facebook.com/v18.0/{page.page_id_platform}/posts"
        params = {"access_token": page.access_token, "fields": "id,message,created_time,likes.summary(true),comments.summary(true),shares"}
        response = requests.get(url, params=params)
        
        if response.status_code == 200:
            posts_data = response.json().get('data', [])
            for p_data in posts_data:
                post_obj, _ = Post.objects.get_or_create(
                    post_id_platform=p_data['id'],
                    defaults={'page': page, 'title': p_data.get('message', ''), 'created_time': parse(p_data['created_time'])}
                )
                
                # Симуляція отримання охоплення (Reach)
                insights_url = f"https://graph.facebook.com/v18.0/{p_data['id']}/insights/post_impressions_unique"
                insights_resp = requests.get(insights_url, params={"access_token": page.access_token})
                reach = insights_resp.json()['data'][0]['values'][0]['value'] if insights_resp.status_code == 200 else 1
                
                PostMetrics.objects.create(
                    post=post_obj,
                    likes=p_data.get('likes', {}).get('summary', {}).get('total_count', 0),
                    comments=p_data.get('comments', {}).get('summary', {}).get('total_count', 0),
                    shares=p_data.get('shares', {}).get('count', 0),
                    reach=reach
                )
    return "Background update completed."

# ==========================================
# 3. БІЗНЕС-ЛОГІКА ТА МАТЕМАТИЧНА МОДЕЛЬ (services.py)
# ==========================================
def calculate_ceri_comprehensive(posts_data, followers_count, total_cost, total_revenue, w1, w2, max_roi, max_cpe):
    """Розрахунок агрегованих та по-постових метрик CERI"""
    total_likes = sum(p.get('likes', 0) for p in posts_data)
    total_comments = sum(p.get('comments', 0) for p in posts_data)
    total_shares = sum(p.get('shares', 0) for p in posts_data)
    total_reach = sum(p.get('reach', 1) for p in posts_data)
    
    total_interactions = total_likes + total_comments + total_shares

    # Агреговані метрики
    agg_er = total_interactions / followers_count if followers_count > 0 else 0
    agg_err = total_interactions / total_reach if total_reach > 0 else 0
    agg_wes = (w1 * agg_er) + (w2 * agg_err)
    
    roi = (total_revenue - total_cost) / total_cost if total_cost > 0 else 0
    cpe = total_cost / total_interactions if total_interactions > 0 else 0
    fcf = 1 + (roi / max_roi) - (cpe / max_cpe)
    
    agg_ceri = agg_wes * fcf

    # По-постовий розрахунок
    per_post_metrics = []
    for p in posts_data:
        p_interactions = p.get('likes', 0) + p.get('comments', 0) + p.get('shares', 0)
        p_er = p_interactions / followers_count if followers_count > 0 else 0
        p_err = p_interactions / p.get('reach', 1) if p.get('reach', 1) > 0 else 0
        p_wes = (w1 * p_er) + (w2 * p_err)
        p_ceri = p_wes * fcf
        
        per_post_metrics.append({
            "post_id": p.get('id'),
            "title": p.get('title', 'Без назви'),
            "likes": p.get('likes', 0),
            "comments": p.get('comments', 0),
            "reach": p.get('reach', 1),
            "er": round(p_er * 100, 2),
            "err": round(p_err * 100, 2),
            "ceri": round(p_ceri, 4)
        })

    return {
        "aggregated": {
            "er": round(agg_er * 100, 2), "err": round(agg_err * 100, 2),
            "wes": round(agg_wes, 4), "roi": round(roi * 100, 2),
            "cpe": round(cpe, 2), "fcf": round(fcf, 4), "ceri": round(agg_ceri, 4)
        },
        "per_post": per_post_metrics
    }

# ==========================================
# 4. REST API КОНТРОЛЕР (views.py)
# ==========================================
from rest_framework.views import APIView
from rest_framework.response import Response

class DashboardAnalyticsView(APIView):
    def get(self, request, page_id):
        # В реальному коді тут витягуються дані з бази (PostMetrics.objects.filter...)
        # Для демонстрації формуємо тестовий масив публікацій
        posts_data = [
            {'id': 1, 'title': 'Модель оцінювання ефективності', 'likes': 2, 'comments': 1, 'shares': 0, 'reach': 12},
            {'id': 2, 'title': 'A Social Media Advertising...', 'likes': 3, 'comments': 2, 'shares': 0, 'reach': 7}
        ]
        
        results = calculate_ceri_comprehensive(
            posts_data=posts_data,
            followers_count=int(request.GET.get('followers', 50000)),
            total_cost=float(request.GET.get('cost', 500)),
            total_revenue=float(request.GET.get('revenue', 1200)),
            w1=float(request.GET.get('w1', 0.5)),
            w2=float(request.GET.get('w2', 0.5)),
            max_roi=float(request.GET.get('max_roi', 3.0)),
            max_cpe=float(request.GET.get('max_cpe', 0.8))
        )
        
        return Response(results)