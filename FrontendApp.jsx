import React, { useState, useEffect } from 'react';
import axios from 'axios';

const FrontendApp = () => {
    // Стан параметрів аналізу
    const [params, setParams] = useState({
        cost: 500, revenue: 1200, followers: 50000,
        w1: 0.5, w2: 0.5, max_roi: 3.0, max_cpe: 0.8
    });

    // Стан результатів та сортування
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'ceri', direction: 'descending' });

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams(params).toString();
            // Запит до нашого Django бекенду
            const response = await axios.get(`http://localhost:8000/api/dashboard/1/?${queryParams}`);
            setMetrics(response.data);
        } catch (error) {
            console.error("Помилка завантаження даних", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const handleParamChange = (e) => {
        setParams({ ...params, [e.target.name]: parseFloat(e.target.value) });
    };

    // Функція сортування для таблиці по-постових метрик [cite: 933]
    const handleSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedPosts = React.useMemo(() => {
        if (!metrics?.per_post) return [];
        let sortablePosts = [...metrics.per_post];
        sortablePosts.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
        return sortablePosts;
    }, [metrics, sortConfig]);

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ color: '#0056b3' }}>Система оцінювання реклами (CERI)</h1>
            
            {/* Блок параметрів [cite: 801, 913-921] */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', background: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
                <div>
                    <h4>Вагові коефіцієнти</h4>
                    <label>W1 (ER): <input type="number" step="0.1" name="w1" value={params.w1} onChange={handleParamChange} /></label><br/>
                    <label>W2 (ERR): <input type="number" step="0.1" name="w2" value={params.w2} onChange={handleParamChange} /></label>
                </div>
                <div>
                    <h4>Фінансові показники</h4>
                    <label>Витрати ($): <input type="number" name="cost" value={params.cost} onChange={handleParamChange} /></label><br/>
                    <label>Дохід ($): <input type="number" name="revenue" value={params.revenue} onChange={handleParamChange} /></label>
                </div>
                <div>
                    <h4>Бенчмарки</h4>
                    <label>Max ROI: <input type="number" step="0.1" name="max_roi" value={params.max_roi} onChange={handleParamChange} /></label><br/>
                    <label>Max CPE ($): <input type="number" step="0.1" name="max_cpe" value={params.max_cpe} onChange={handleParamChange} /></label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button onClick={fetchAnalytics} style={{ padding: '10px 20px', background: '#0056b3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        Оновити розрахунок
                    </button>
                </div>
            </div>

            {loading ? <p>Оновлення даних у фоновому режимі...</p> : metrics && (
                <>
                    {/* Агреговані метрики [cite: 904, 930-932] */}
                    <div style={{ background: '#e9ecef', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                        <h2>Агреговані результати за період</h2>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                                <p><strong>ER:</strong> {metrics.aggregated.er}%</p>
                                <p><strong>ERR:</strong> {metrics.aggregated.err}%</p>
                                <p><strong>WES:</strong> {metrics.aggregated.wes}</p>
                            </div>
                            <div>
                                <p><strong>ROI:</strong> {metrics.aggregated.roi}%</p>
                                <p><strong>CPE:</strong> ${metrics.aggregated.cpe}</p>
                                <p><strong>FCF:</strong> {metrics.aggregated.fcf}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <h3>Інтегральний показник</h3>
                                <h1 style={{ color: metrics.aggregated.ceri > 1 ? '#28a745' : '#dc3545', margin: 0 }}>
                                    CERI: {metrics.aggregated.ceri}
                                </h1>
                            </div>
                        </div>
                    </div>

                    {/* Таблиця по-постових метрик [cite: 905, 933-938] */}
                    <h2>Детальна статистика публікацій</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#0056b3', color: 'white' }}>
                                <th style={{ padding: '10px' }}>Публікація</th>
                                <th style={{ padding: '10px', cursor: 'pointer' }} onClick={() => handleSort('likes')}>Лайки ↕</th>
                                <th style={{ padding: '10px', cursor: 'pointer' }} onClick={() => handleSort('reach')}>Охоплення ↕</th>
                                <th style={{ padding: '10px', cursor: 'pointer' }} onClick={() => handleSort('er')}>ER (%) ↕</th>
                                <th style={{ padding: '10px', cursor: 'pointer' }} onClick={() => handleSort('err')}>ERR (%) ↕</th>
                                <th style={{ padding: '10px', cursor: 'pointer' }} onClick={() => handleSort('ceri')}>CERI ↕</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedPosts.map((post) => (
                                <tr key={post.post_id} style={{ borderBottom: '1px solid #ddd' }}>
                                    <td style={{ padding: '10px' }}>{post.title}</td>
                                    <td style={{ padding: '10px' }}>{post.likes}</td>
                                    <td style={{ padding: '10px' }}>{post.reach}</td>
                                    <td style={{ padding: '10px' }}>{post.er}</td>
                                    <td style={{ padding: '10px' }}>{post.err}</td>
                                    <td style={{ padding: '10px', fontWeight: 'bold', color: post.ceri > 0.1 ? 'green' : 'black' }}>
                                        {post.ceri}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
        </div>
    );
};

export default FrontendApp;