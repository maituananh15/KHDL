// URL gốc của API (tự động lấy theo domain hiện tại, hỗ trợ khi deploy)
const API_BASE = `${window.location.origin}/api`;

// Trạng thái dùng chung cho toàn bộ ứng dụng (frontend)
let currentUser = null;
let currentPage = 1;
let totalPages = 1;
let movies = [];
let genres = [];
let years = [];
let recommendationsLimit = parseInt(localStorage.getItem('recommendationsLimit')) || 50;

// Trạng thái phân trang cho trang lịch sử
let historyPage = 1;
let historyTotalPages = 1;

// Movie hiện đang xem ở trang Watch (dùng cho đánh giá)
let currentWatchMovieId = null;

// Khởi tạo ứng dụng khi trang được load xong
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadGenres();
    loadYears();
    showHome();
});

// Xử lý xác thực (đăng nhập / đăng ký / kiểm tra token)
function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                currentUser = data.user;
                updateUIForAuth();
            } else {
                localStorage.removeItem('token');
            }
        })
        .catch(() => {
            localStorage.removeItem('token');
        });
    }
}

function updateUIForAuth() {
    if (currentUser) {
        document.getElementById('authButtons').style.display = 'none';
        document.getElementById('userMenu').style.display = 'flex';
        document.getElementById('username').textContent = currentUser.username;
    } else {
        document.getElementById('authButtons').style.display = 'flex';
        document.getElementById('userMenu').style.display = 'none';
    }
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    showLoading();
    fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    })
    .then(res => res.json())
    .then(data => {
        hideLoading();
        if (data.success) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            updateUIForAuth();
            showToast('Đăng nhập thành công!', 'success');
            showHome();
        } else {
            showToast(data.message || 'Đăng nhập thất bại', 'error');
        }
    })
    .catch(err => {
        hideLoading();
        showToast('Lỗi kết nối', 'error');
        console.error(err);
    });
}

function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    showLoading();
    fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
    })
    .then(res => res.json())
    .then(data => {
        hideLoading();
        if (data.success) {
            showToast('Đăng ký thành công! Vui lòng đăng nhập.', 'success');
            showLogin();
        } else {
            showToast(data.message || 'Đăng ký thất bại', 'error');
        }
    })
    .catch(err => {
        hideLoading();
        showToast('Lỗi kết nối', 'error');
        console.error(err);
    });
}

function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    updateUIForAuth();
    showToast('Đã đăng xuất', 'success');
    showHome();
}

// Điều hướng giữa các trang (Home, Phim, Gợi ý, Lịch sử, Dashboard, Đánh giá)
function hideAllPages() {
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
}

function showHome() {
    hideAllPages();
    document.getElementById('homePage').style.display = 'block';
    loadTrendingMovies();
}

function showLogin() {
    hideAllPages();
    document.getElementById('loginPage').style.display = 'block';
}

function showRegister() {
    hideAllPages();
    document.getElementById('registerPage').style.display = 'block';
}

function showMovies() {
    hideAllPages();
    document.getElementById('moviesPage').style.display = 'block';
    loadMovies();
}

function showRecommendations() {
    hideAllPages();
    document.getElementById('recommendationsPage').style.display = 'block';
    
    // Cập nhật UI dựa trên trạng thái đăng nhập
    const limitContainer = document.getElementById('recommendationsLimitContainer');
    const limitSelect = document.getElementById('recommendationsLimit');
    const titleElement = document.querySelector('#recommendationsPage h2');
    
    if (currentUser) {
        // Đã đăng nhập: hiển thị dropdown limit
        if (limitContainer) {
            limitContainer.style.display = 'flex';
        }
        if (limitSelect) {
            const savedLimit = localStorage.getItem('recommendationsLimit') || '50';
            limitSelect.value = savedLimit;
        }
        if (titleElement) {
            titleElement.textContent = 'Gợi ý phim dành cho bạn';
        }
    } else {
        // Chưa đăng nhập: ẩn dropdown limit
        if (limitContainer) {
            limitContainer.style.display = 'none';
        }
        if (titleElement) {
            titleElement.textContent = 'Gợi ý dành cho bạn';
        }
    }
    
    recommendationsPage = 1; // Reset về trang 1
    loadRecommendations(1);
}

function changeRecommendationsLimit() {
    if (!currentUser) return; // Chỉ cho phép thay đổi khi đã đăng nhập
    
    const select = document.getElementById('recommendationsLimit');
    if (select) {
        const newLimit = select.value;
        localStorage.setItem('recommendationsLimit', newLimit);
        recommendationsPage = 1; // Reset về trang 1
        loadRecommendations(1); // Reload với limit mới
    }
}

function showHistory() {
    if (!currentUser) {
        showToast('Vui lòng đăng nhập để xem lịch sử', 'error');
        showLogin();
        return;
    }
    
    hideAllPages();
    document.getElementById('historyPage').style.display = 'block';
    historyPage = 1; // Reset về trang 1
    loadHistory(1);
}

function showDashboard() {
    hideAllPages();
    document.getElementById('dashboardPage').style.display = 'block';
    loadDashboard();
}

function showEvaluation() {
    hideAllPages();
    document.getElementById('evaluationPage').style.display = 'block';
    loadEvaluationMetrics();
}

// Phim thịnh hành (hiển thị ở trang Home)
function loadTrendingMovies() {
    const grid = document.getElementById('trendingMoviesGrid');
    if (!grid) return;
    
    grid.innerHTML = '<p>Đang tải phim thịnh hành...</p>';
    
    fetch(`${API_BASE}/movies/stats/trending?limit=5`)
    .then(res => res.json())
    .then(data => {
        if (data.success && data.data && data.data.length > 0) {
            displayMoviesInGrid(data.data, 'trendingMoviesGrid');
        } else {
            grid.innerHTML = '<p>Không tìm thấy phim nào.</p>';
        }
    })
    .catch(err => {
        grid.innerHTML = '<p>Lỗi khi tải phim thịnh hành.</p>';
        console.error(err);
    });
}

// Danh sách phim (trang "Phim")
function loadMovies(page = 1) {
    showLoading();
    const search = document.getElementById('searchInput')?.value || '';
    const genre = document.getElementById('genreFilter')?.value || '';
    const year = document.getElementById('yearFilter')?.value || '';
    
    let url = `${API_BASE}/movies?page=${page}&limit=20`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (genre) url += `&genre=${encodeURIComponent(genre)}`;
    if (year) url += `&year=${year}`;
    
    fetch(url)
    .then(res => res.json())
    .then(data => {
        hideLoading();
        if (data.success) {
            movies = data.data;
            currentPage = data.page;
            totalPages = data.pages;
            displayMovies(movies);
            displayPagination();
        }
    })
    .catch(err => {
        hideLoading();
        showToast('Lỗi khi tải danh sách phim', 'error');
        console.error(err);
    });
}

function displayMovies(movieList) {
    displayMoviesInGrid(movieList, 'moviesGrid');
}

function displayMoviesInGrid(movieList, gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) {
        console.error(`Grid ${gridId} not found`);
        return;
    }
    
    grid.innerHTML = '';
    
    if (!movieList || movieList.length === 0) {
        grid.innerHTML = '<p>Không tìm thấy phim nào.</p>';
        return;
    }
    
    movieList.forEach(movie => {
        if (movie && movie._id) {
            const card = createMovieCard(movie);
            grid.appendChild(card);
        }
    });
}

function createMovieCard(movie) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.onclick = () => showMovieDetail(movie._id);
    
    card.innerHTML = `
        <img src="${movie.poster || 'https://via.placeholder.com/300x450'}" 
             alt="${movie.title}" 
             class="movie-poster"
             onerror="this.src='https://via.placeholder.com/300x450'">
        <div class="movie-info">
            <h3 class="movie-title">${movie.title}</h3>
            <div class="movie-meta">${movie.year || 'N/A'}</div>
            <div class="movie-rating">⭐ ${movie.rating || 'N/A'}</div>
        </div>
    `;
    
    return card;
}

function loadGenres() {
    fetch(`${API_BASE}/movies/stats/genres`)
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            genres = data.data;
            const select = document.getElementById('genreFilter');
            if (select) {
                genres.forEach(genre => {
                    const option = document.createElement('option');
                    option.value = genre.genre;
                    option.textContent = `${genre.genre} (${genre.count})`;
                    select.appendChild(option);
                });
            }
        }
    })
    .catch(err => console.error(err));
}

function loadYears() {
    // Sinh danh sách năm từ 1990 đến năm hiện tại
    const currentYear = new Date().getFullYear();
    const select = document.getElementById('yearFilter');
    if (select) {
        for (let year = currentYear; year >= 1990; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            select.appendChild(option);
        }
    }
}

function searchMovies(e) {
    if (e.key === 'Enter') {
        loadMovies(1);
    }
}

function filterMovies() {
    loadMovies(1);
}

function displayPagination() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;
    
    pagination.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Nút về trang trước
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Trước';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => loadMovies(currentPage - 1);
    pagination.appendChild(prevBtn);
    
    // Phân trang "thông minh": chỉ hiển thị một dải xung quanh trang hiện tại
    const maxVisiblePages = 7; // Số nút trang hiển thị tối đa
    let startPage = 1;
    let endPage = totalPages;
    
    if (totalPages > maxVisiblePages) {
        // Tính toán phạm vi hiển thị xung quanh trang hiện tại
        const halfVisible = Math.floor(maxVisiblePages / 2);
        
        if (currentPage <= halfVisible) {
            // Ở đầu danh sách trang: hiển thị 1 đến maxVisiblePages
            startPage = 1;
            endPage = maxVisiblePages;
        } else if (currentPage >= totalPages - halfVisible) {
            // Ở cuối danh sách trang: hiển thị các trang cuối
            startPage = totalPages - maxVisiblePages + 1;
            endPage = totalPages;
        } else {
            // Ở giữa: hiển thị các trang xung quanh currentPage
            startPage = currentPage - halfVisible;
            endPage = currentPage + halfVisible;
        }
    }
    
    // Hiển thị trang đầu tiên
    if (startPage > 1) {
        const btn1 = document.createElement('button');
        btn1.textContent = '1';
        btn1.className = 1 === currentPage ? 'active' : '';
        btn1.onclick = () => loadMovies(1);
        pagination.appendChild(btn1);
        
        // Hiển thị dấu "..." nếu cần
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.padding = '10px';
            dots.style.color = '#6b7280';
            pagination.appendChild(dots);
        }
    }
    
    // Hiển thị các nút trang trong phạm vi tính toán
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = i === currentPage ? 'active' : '';
        btn.onclick = () => loadMovies(i);
        pagination.appendChild(btn);
    }
    
    // Hiển thị trang cuối cùng
    if (endPage < totalPages) {
        // Hiển thị dấu "..." nếu còn khoảng trống giữa endPage và trang cuối
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.padding = '10px';
            dots.style.color = '#6b7280';
            pagination.appendChild(dots);
        }
        
        const btnLast = document.createElement('button');
        btnLast.textContent = totalPages;
        btnLast.className = totalPages === currentPage ? 'active' : '';
        btnLast.onclick = () => loadMovies(totalPages);
        pagination.appendChild(btnLast);
    }
    
    // Nút sang trang tiếp theo
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Sau →';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => loadMovies(currentPage + 1);
    pagination.appendChild(nextBtn);
}

// Chi tiết phim (hiển thị trong modal)
function showMovieDetail(movieId) {
    showLoading();
    fetch(`${API_BASE}/movies/${movieId}`)
    .then(res => res.json())
    .then(data => {
        hideLoading();
        if (data.success) {
            const movie = data.data;
            displayMovieDetail(movie);
        }
    })
    .catch(err => {
        hideLoading();
        showToast('Lỗi khi tải thông tin phim', 'error');
        console.error(err);
    });
}

function displayMovieDetail(movie) {
    const modal = document.getElementById('movieModal');
    const detail = document.getElementById('movieDetail');
    
    const genresHtml = movie.genres && movie.genres.length > 0
        ? movie.genres.map(g => `<span class="genre-tag">${g}</span>`).join('')
        : '';
    
    detail.innerHTML = `
        <div class="movie-detail">
            <img src="${movie.poster || 'https://via.placeholder.com/300x450'}" 
                 alt="${movie.title}" 
                 class="movie-detail-poster"
                 onerror="this.src='https://via.placeholder.com/300x450'">
            <div class="movie-detail-info">
                <h2>${movie.title}</h2>
                <p><strong>Năm:</strong> ${movie.year || 'N/A'}</p>
                <p><strong>Đạo diễn:</strong> ${movie.director || 'N/A'}</p>
                <p><strong>Đánh giá:</strong> ⭐ ${movie.rating || 'N/A'}/10</p>
                <p><strong>Thời lượng:</strong> ${movie.duration || 'N/A'} phút</p>
                <p><strong>Quốc gia:</strong> ${movie.country || 'N/A'}</p>
                <div class="genres">${genresHtml}</div>
                <p><strong>Mô tả:</strong></p>
                <p>${movie.description || 'Không có mô tả'}</p>
                <div style="margin-top: 20px;">
                    <button class="btn btn-primary btn-large" onclick="showWatchPage('${movie._id}')">▶ Xem phim</button>
                </div>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
}

function closeMovieModal() {
    document.getElementById('movieModal').style.display = 'none';
}

function recordView(movieId) {
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('No token, skipping view recording');
        return;
    }
    
    fetch(`${API_BASE}/history/view`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            movieId: movieId,
            action: 'view'
        })
    })
    .then(res => {
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
    })
    .then(data => {
        if (data.success) {
            console.log('✓ View recorded:', movieId);
        } else {
            console.error('Failed to record view:', data.message);
        }
    })
    .catch(err => {
        console.error('Error recording view:', err);
    });
}

// Gợi ý phim (trang "Gợi ý")
function loadRecommendations(page = 1) {
    const grid = document.getElementById('recommendationsGrid');
    if (!grid) {
        console.error('recommendationsGrid not found');
        return;
    }
    
    grid.innerHTML = '<p>Đang tải...</p>';
    showLoading();
    
    const token = localStorage.getItem('token');
    
    // Nếu không đăng nhập: không hiển thị gợi ý
    if (!token || !currentUser) {
        hideLoading();
        grid.innerHTML = '<p>Đăng nhập để xem gợi ý phim dành cho bạn.</p>';
        document.getElementById('recommendationsPagination').innerHTML = '';
        return;
    }
    
    // Nếu đã đăng nhập: hiển thị gợi ý dựa trên bộ phim gần đây bạn đã xem
    // (content-based theo mô tả/nội dung phim đó). Hiển thị tối đa 30 phim cho mỗi lần tải.
    const limit = 30;
    
    // Chỉ lấy tối đa 30 phim và không phân trang ở frontend (API đã xử lý)
    fetch(`${API_BASE}/recommendations?page=1&limit=${limit}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => {
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
    })
    .then(data => {
        hideLoading();
        console.log('Recommendations data:', data);
        
        if (data.success && data.data && data.data.length > 0) {
            displayMoviesInGrid(data.data.slice(0, 30), 'recommendationsGrid');
            document.getElementById('recommendationsPagination').innerHTML = '';
        } else if (data.success && data.data && data.data.length === 0) {
            grid.innerHTML = '<p>Chưa có gợi ý. Hãy xem một số phim để chúng tôi hiểu sở thích của bạn!</p>';
            document.getElementById('recommendationsPagination').innerHTML = '';
        } else {
            grid.innerHTML = '<p>Không thể tải gợi ý. Vui lòng thử lại sau.</p>';
            console.error('Invalid response:', data);
            document.getElementById('recommendationsPagination').innerHTML = '';
        }
    })
    .catch(err => {
        hideLoading();
        grid.innerHTML = '<p>Lỗi khi tải gợi ý. Vui lòng thử lại sau.</p>';
        showToast('Lỗi khi tải gợi ý', 'error');
        console.error('Error loading recommendations:', err);
    });
}

// Lịch sử xem phim
function loadHistory(page = 1) {
    const token = localStorage.getItem('token');
    if (!token) {
        showToast('Vui lòng đăng nhập', 'error');
        return;
    }
    
    const grid = document.getElementById('historyGrid');
    if (!grid) {
        console.error('historyGrid not found');
        return;
    }
    
    grid.innerHTML = '<p>Đang tải lịch sử...</p>';
    showLoading();
    
    const limit = 20; // mỗi trang hiển thị 20 phim trong lịch sử
    
    fetch(`${API_BASE}/history/movies?page=${page}&limit=${limit}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => {
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
    })
    .then(data => {
        hideLoading();
        console.log('History data:', data);
        
        if (data.success && data.data && data.data.length > 0) {
            displayMoviesInGrid(data.data, 'historyGrid');
            historyPage = data.page || page;
            historyTotalPages = data.pages || 1;
            displayHistoryPagination();
        } else if (data.success && data.data && data.data.length === 0) {
            grid.innerHTML = '<p>Bạn chưa xem phim nào. Hãy xem một số phim để lưu lịch sử!</p>';
            document.getElementById('historyPagination').innerHTML = '';
        } else {
            grid.innerHTML = '<p>Không thể tải lịch sử. Vui lòng thử lại sau.</p>';
            console.error('Invalid response:', data);
        }
    })
    .catch(err => {
        hideLoading();
        grid.innerHTML = '<p>Lỗi khi tải lịch sử. Vui lòng thử lại sau.</p>';
        showToast('Lỗi khi tải lịch sử', 'error');
        console.error('Error loading history:', err);
    });
}

function displayHistoryPagination() {
    const pagination = document.getElementById('historyPagination');
    if (!pagination) return;
    
    pagination.innerHTML = '';
    
    if (historyTotalPages <= 1) return;
    
    // Nút về trang trước (lịch sử)
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Trước';
    prevBtn.disabled = historyPage === 1;
    prevBtn.onclick = () => loadHistory(historyPage - 1);
    pagination.appendChild(prevBtn);
    
    // Phân trang "thông minh" cho lịch sử
    const maxVisiblePages = 7;
    let startPage = 1;
    let endPage = historyTotalPages;
    
    if (historyTotalPages > maxVisiblePages) {
        const halfVisible = Math.floor(maxVisiblePages / 2);
        
        if (historyPage <= halfVisible) {
            startPage = 1;
            endPage = maxVisiblePages;
        } else if (historyPage >= historyTotalPages - halfVisible) {
            startPage = historyTotalPages - maxVisiblePages + 1;
            endPage = historyTotalPages;
        } else {
            startPage = historyPage - halfVisible;
            endPage = historyPage + halfVisible;
        }
    }
    
    // Nút về trang đầu tiên
    if (startPage > 1) {
        const btn1 = document.createElement('button');
        btn1.textContent = '1';
        btn1.className = 1 === historyPage ? 'active' : '';
        btn1.onclick = () => loadHistory(1);
        pagination.appendChild(btn1);
        
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.padding = '10px';
            dots.style.color = '#6b7280';
            pagination.appendChild(dots);
        }
    }
    
    // Các nút trang trong phạm vi hiển thị
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = i === historyPage ? 'active' : '';
        btn.onclick = () => loadHistory(i);
        pagination.appendChild(btn);
    }
    
    // Nút tới trang cuối cùng
    if (endPage < historyTotalPages) {
        if (endPage < historyTotalPages - 1) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.padding = '10px';
            dots.style.color = '#6b7280';
            pagination.appendChild(dots);
        }
        
        const btnLast = document.createElement('button');
        btnLast.textContent = historyTotalPages;
        btnLast.className = historyTotalPages === historyPage ? 'active' : '';
        btnLast.onclick = () => loadHistory(historyTotalPages);
        pagination.appendChild(btnLast);
    }
    
    // Nút sang trang tiếp theo (lịch sử)
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Sau →';
    nextBtn.disabled = historyPage === historyTotalPages;
    nextBtn.onclick = () => loadHistory(historyPage + 1);
    pagination.appendChild(nextBtn);
}

// Các hàm tiện ích chung (loading, thông báo toast)
function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Dashboard thống kê (biểu đồ, số liệu tổng quan)
let ratingChart = null;
let genreChart = null;
let topRatingChart = null;

function loadDashboard() {
    showLoading();
    
    // Gọi API lấy thống kê tổng quan (tổng số phim, rating trung bình, tổng lượt xem, số thể loại)
    fetch(`${API_BASE}/stats/summary`)
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById('totalMovies').textContent = (data.data.totalMovies || 0).toLocaleString();
            document.getElementById('avgRating').textContent = (data.data.avgRating || 0).toFixed(2);
            document.getElementById('totalViews').textContent = (data.data.totalViews || 0).toLocaleString();
            document.getElementById('uniqueGenres').textContent = data.data.uniqueGenres || 0;
        }
    })
    .catch(err => console.error('Error loading summary:', err));
    
    // Gọi API lấy phân bố rating để vẽ histogram
    fetch(`${API_BASE}/stats/rating-distribution`)
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            createRatingChart(data.data);
        }
    })
    .catch(err => {
        console.error('Error loading rating distribution:', err);
        hideLoading();
    });
    
    // Gọi API lấy tần suất xuất hiện của các thể loại
    fetch(`${API_BASE}/stats/genre-frequency`)
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            createGenreChart(data.data);
        }
    })
    .catch(err => console.error('Error loading genre frequency:', err));
    
    // Gọi API lấy danh sách phim có rating cao nhất để vẽ biểu đồ top rating
    fetch(`${API_BASE}/stats/top-items?limit=10`)
    .then(res => res.json())
    .then(data => {
        hideLoading();
        if (data.success && data.data && data.data.byRating && data.data.byRating.length > 0) {
            console.log('Top rating data:', data.data.byRating);
            createTopRatingChart(data.data.byRating);
        } else {
            console.warn('Không có dữ liệu để vẽ biểu đồ top rating');
            // Nếu không có dữ liệu thì hiển thị thông báo thay cho biểu đồ
            const chartContainer = document.querySelector('#topRatingChart')?.parentElement;
            if (chartContainer && data.success && (!data.data.byRating || data.data.byRating.length === 0)) {
                const canvas = document.getElementById('topRatingChart');
                if (canvas) {
                    canvas.parentElement.innerHTML = '<p>Chưa có dữ liệu rating</p>';
                }
            }
        }
    })
    .catch(err => {
        hideLoading();
        console.error('Lỗi khi tải dữ liệu top rating:', err);
        const canvas = document.getElementById('topRatingChart');
        if (canvas) {
            canvas.parentElement.innerHTML = '<p>Lỗi khi tải dữ liệu</p>';
        }
    });
}

// Evaluation
function loadEvaluationMetrics() {
    showLoading();
    fetch(`${API_BASE}/evaluation`)
    .then(res => res.json())
    .then(data => {
        hideLoading();
        if (data.success && data.data) {
            const metrics = data.data;
            document.getElementById('metricRmse').textContent = metrics.rmse ?? '-';
            document.getElementById('metricMae').textContent = metrics.mae ?? '-';
            document.getElementById('metricPrecision').textContent = metrics.precisionAtK ?? '-';
            document.getElementById('metricRecall').textContent = metrics.recallAtK ?? '-';
            const noteParts = [];
            if (metrics.k) {
                noteParts.push(`K = ${metrics.k}`);
            }
            if (metrics.updatedAt) {
                noteParts.push(`Cập nhật: ${new Date(metrics.updatedAt).toLocaleString()}`);
            }
            if (metrics.note) {
                noteParts.push(metrics.note);
            }
            document.getElementById('evaluationNote').textContent = noteParts.join(' • ');
        } else {
            document.getElementById('evaluationNote').textContent = 'Không lấy được dữ liệu đánh giá.';
        }
    })
    .catch(err => {
        hideLoading();
        document.getElementById('evaluationNote').textContent = 'Lỗi khi tải dữ liệu đánh giá.';
        console.error('Error loading evaluation metrics:', err);
    });
}

function createRatingChart(data) {
    const ctx = document.getElementById('ratingChart');
    if (!ctx) return;
    
    if (ratingChart) {
        ratingChart.destroy();
    }
    
    ratingChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Số lượng phim',
                data: data.values,
                backgroundColor: 'rgba(99, 102, 241, 0.6)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

function createGenreChart(data) {
    const ctx = document.getElementById('genreChart');
    if (!ctx) return;
    
    if (genreChart) {
        genreChart.destroy();
    }
    
    const labels = data.map(item => item.genre);
    const values = data.map(item => item.count);
    
    genreChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Số lượng phim',
                data: values,
                backgroundColor: 'rgba(16, 185, 129, 0.6)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function createTopRatingChart(data) {
    const ctx = document.getElementById('topRatingChart');
    if (!ctx) {
        console.error('topRatingChart canvas not found');
        return;
    }
    
    if (!data || data.length === 0) {
        console.warn('No data provided for top rating chart');
        ctx.parentElement.innerHTML = '<p>Chưa có dữ liệu rating</p>';
        return;
    }
    
    if (topRatingChart) {
        topRatingChart.destroy();
    }
    
    // Filter out items without rating and convert to number
    const validData = data
        .filter(item => item && item.title && (item.rating !== null && item.rating !== undefined))
        .map(item => ({
            title: item.title,
            rating: parseFloat(item.rating) || 0
        }))
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 10);
    
    if (validData.length === 0) {
        ctx.parentElement.innerHTML = '<p>Không có phim nào có rating</p>';
        return;
    }
    
    const labels = validData.map(item => {
        const title = item.title.length > 35 ? item.title.substring(0, 35) + '...' : item.title;
        return title;
    });
    const values = validData.map(item => parseFloat(item.rating).toFixed(1));
    
    console.log('Creating top rating chart with:', { 
        count: validData.length, 
        labels: labels.slice(0, 3) + '...', 
        values: values.slice(0, 3) 
    });
    
    topRatingChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Rating',
                data: values,
                backgroundColor: 'rgba(239, 68, 68, 0.6)',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Rating: ${context.parsed.x}/10`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 10,
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            return value + '/10';
                        }
                    }
                }
            }
        }
    });
}


// Watch Page
function showWatchPage(movieId) {
    // Đóng modal nếu đang mở
    closeMovieModal();
    
    hideAllPages();
    document.getElementById('watchPage').style.display = 'block';
    
    showLoading();
    
    // Lưu lại movieId hiện tại để phục vụ tính năng đánh giá
    currentWatchMovieId = movieId;

    // Gọi API lấy thông tin chi tiết của phim đang xem
    fetch(`${API_BASE}/movies/${movieId}`)
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const movie = data.data;
            displayWatchPage(movie);
            
            // Ghi lại lịch sử xem phim cho user
            if (currentUser) {
                recordView(movieId);
            }
            
            // Gọi API lấy danh sách phim đề xuất (tương tự phim này)
            loadWatchSuggestions(movieId);
        } else {
            hideLoading();
            showToast('Không tìm thấy phim', 'error');
        }
    })
    .catch(err => {
        hideLoading();
        showToast('Lỗi khi tải thông tin phim', 'error');
        console.error(err);
    });
}

function displayWatchPage(movie) {
    document.getElementById('watchPoster').src = movie.poster || 'https://via.placeholder.com/800x1200';
    document.getElementById('watchPoster').alt = movie.title;
    document.getElementById('watchTitle').textContent = movie.title;
    document.getElementById('watchYear').textContent = movie.year ? `Năm: ${movie.year}` : '';
    document.getElementById('watchRating').textContent = movie.rating ? `⭐ ${movie.rating}/10` : '';
    document.getElementById('watchDuration').textContent = movie.duration ? `${movie.duration} phút` : '';
    document.getElementById('watchDirector').textContent = movie.director || 'N/A';
    document.getElementById('watchCountry').textContent = movie.country || 'N/A';
    document.getElementById('watchDescription').textContent = movie.description || 'Không có mô tả';
    
    // Genres
    const genresContainer = document.getElementById('watchGenres');
    if (movie.genres && movie.genres.length > 0) {
        genresContainer.innerHTML = movie.genres.map(g => `<span class="genre-tag">${g}</span>`).join('');
    } else {
        genresContainer.innerHTML = '';
    }
    
    // Reset UI đánh giá của user
    const select = document.getElementById('userRatingSelect');
    const status = document.getElementById('userRatingStatus');
    if (select) select.value = '';
    if (status) status.textContent = '';

    hideLoading();
}

// Gửi rating của user cho phim đang xem
function submitUserRating() {
    if (!currentUser) {
        showToast('Vui lòng đăng nhập để đánh giá phim', 'error');
        showLogin();
        return;
    }

    if (!currentWatchMovieId) {
        showToast('Không xác định được phim để đánh giá', 'error');
        return;
    }

    const select = document.getElementById('userRatingSelect');
    const status = document.getElementById('userRatingStatus');
    if (!select) return;

    const ratingValue = parseFloat(select.value);
    if (!ratingValue) {
        showToast('Vui lòng chọn số sao trước khi gửi', 'error');
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        showToast('Vui lòng đăng nhập để đánh giá phim', 'error');
        showLogin();
        return;
    }

    if (status) {
        status.textContent = 'Đang gửi đánh giá...';
    }

    fetch(`${API_BASE}/ratings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            movieId: currentWatchMovieId,
            rating: ratingValue
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('Đã lưu đánh giá của bạn', 'success');
            if (status) {
                status.textContent = `Bạn đã đánh giá ${ratingValue} sao cho phim này`;
            }
        } else {
            showToast(data.message || 'Lưu đánh giá thất bại', 'error');
            if (status) {
                status.textContent = 'Lỗi khi lưu đánh giá';
            }
        }
    })
    .catch(err => {
        console.error('Error submitting rating:', err);
        showToast('Lỗi khi gửi đánh giá', 'error');
        if (status) {
            status.textContent = 'Lỗi khi gửi đánh giá';
        }
    });
}

function loadWatchSuggestions(movieId) {
    const suggestionsContainer = document.getElementById('watchSuggestions');
    suggestionsContainer.innerHTML = '<p>Đang tải phim đề xuất...</p>';
    
    fetch(`${API_BASE}/recommendations/similar/${movieId}?limit=10`)
    .then(res => res.json())
    .then(data => {
        if (data.success && data.data && data.data.length > 0) {
            displayWatchSuggestions(data.data);
        } else {
            suggestionsContainer.innerHTML = '<p>Không có phim đề xuất.</p>';
        }
    })
    .catch(err => {
        console.error('Error loading suggestions:', err);
        suggestionsContainer.innerHTML = '<p>Lỗi khi tải phim đề xuất.</p>';
    });
}

function displayWatchSuggestions(movies) {
    const container = document.getElementById('watchSuggestions');
    container.innerHTML = '';
    
    movies.forEach(movie => {
        const suggestionCard = document.createElement('div');
        suggestionCard.className = 'watch-suggestion-card';
        suggestionCard.onclick = () => {
            showWatchPage(movie._id);
        };
        
        suggestionCard.innerHTML = `
            <img src="${movie.poster || 'https://via.placeholder.com/200x300'}" 
                 alt="${movie.title}" 
                 class="watch-suggestion-poster"
                 onerror="this.src='https://via.placeholder.com/200x300'">
            <div class="watch-suggestion-info">
                <h4 class="watch-suggestion-title">${movie.title}</h4>
                <div class="watch-suggestion-meta">
                    <span>${movie.year || 'N/A'}</span>
                    <span>⭐ ${movie.rating || 'N/A'}</span>
                </div>
            </div>
        `;
        
        container.appendChild(suggestionCard);
    });
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('movieModal');
    if (event.target === modal) {
        closeMovieModal();
    }
}

