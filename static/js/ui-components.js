document.addEventListener('DOMContentLoaded', function () {
    // Sidebar Dropdown Functionality
    const allDropdown = document.querySelectorAll('#sidebar .side-dropdown');
    const sidebar = document.getElementById('sidebar');

    allDropdown.forEach(item => {
        const a = item.parentElement.querySelector('a:first-child');
        a.addEventListener('click', function (e) {
            e.preventDefault();

            if (!this.classList.contains('active')) {
                allDropdown.forEach(i => {
                    const aLink = i.parentElement.querySelector('a:first-child');
                    aLink.classList.remove('active');
                    i.classList.remove('show');
                })
            }

            this.classList.toggle('active');
            item.classList.toggle('show');
        })
    });

    // Sidebar Collapse Functionality
    const toggleSidebar = document.querySelector('nav .toggle-sidebar');
    const allSideDivider = document.querySelectorAll('#sidebar .divider');

    if (sidebar.classList.contains('hide')) {
        allSideDivider.forEach(item => {
            item.textContent = '-';
        });
        allDropdown.forEach(item => {
            const a = item.parentElement.querySelector('a:first-child');
            a.classList.remove('active');
            item.classList.remove('show');
        });
    } else {
        allSideDivider.forEach(item => {
            item.textContent = item.dataset.text;
        });
    }

    toggleSidebar.addEventListener('click', function () {
        sidebar.classList.toggle('hide');

        if (sidebar.classList.contains('hide')) {
            allSideDivider.forEach(item => {
                item.textContent = '-';
            });

            allDropdown.forEach(item => {
                const a = item.parentElement.querySelector('a:first-child');
                a.classList.remove('active');
                item.classList.remove('show');
            });
        } else {
            allSideDivider.forEach(item => {
                item.textContent = item.dataset.text;
            });
        }
    });

    sidebar.addEventListener('mouseleave', function () {
        if (this.classList.contains('hide')) {
            allDropdown.forEach(item => {
                const a = item.parentElement.querySelector('a:first-child');
                a.classList.remove('active');
                item.classList.remove('show');
            });
            allSideDivider.forEach(item => {
                item.textContent = '-';
            });
        }
    });

    sidebar.addEventListener('mouseenter', function () {
        if (this.classList.contains('hide')) {
            allDropdown.forEach(item => {
                const a = item.parentElement.querySelector('a:first-child');
                a.classList.remove('active');
                item.classList.remove('show');
            });
            allSideDivider.forEach(item => {
                item.textContent = item.dataset.text;
            });
        }
    });

    // Profile Dropdown Functionality
    const profile = document.querySelector('nav .profile');
    const imgProfile = profile.querySelector('img');
    const dropdownProfile = profile.querySelector('.profile-link');

    imgProfile.addEventListener('click', function () {
        dropdownProfile.classList.toggle('show');
    });

    // Menu Toggle Functionality
    const allMenu = document.querySelectorAll('main .content-data .head .menu, main .content-data-mushroom .head .menu ');

    allMenu.forEach(item => {
        const icon = item.querySelector('.icon');
        const menuLink = item.querySelector('.menu-link');

        icon.addEventListener('click', function () {
            menuLink.classList.toggle('show');
        })
    });

    window.addEventListener('click', function (e) {
        if (e.target !== imgProfile && !dropdownProfile.contains(e.target)) {
            dropdownProfile.classList.remove('show');
        }

        allMenu.forEach(item => {
            const icon = item.querySelector('.icon');
            const menuLink = item.querySelector('.menu-link');

            if (e.target !== icon && e.target !== menuLink) {
                menuLink.classList.remove('show');
            }
        });
    });

    // Notification Bell Functionality
    const bellIcon = document.getElementById('bell-icon');
    const notificationTab = document.getElementById('notification-tab');
    const notificationList = document.getElementById('notification-list');
    const notificationCounter = document.getElementById('notification-counter');
    let notificationCount = 0;

    bellIcon.addEventListener('click', () => {
        notificationTab.classList.toggle('show');
    });

    document.addEventListener('click', (event) => {
        if (!notificationTab.contains(event.target) && event.target !== bellIcon) {
            notificationTab.classList.remove('show');
        }
    });

    function createNotification(message) {
        const notificationItem = document.createElement('li');
        const notificationText = document.createElement('span');
        notificationText.classList.add('notification-text');
        notificationText.textContent = message;

        const closeButton = document.createElement('button');
        closeButton.classList.add('close-btn');
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', () => {
            notificationItem.remove();
            notificationCount--;
            updateNotificationCounter();
        });

        notificationItem.appendChild(notificationText);
        notificationItem.appendChild(closeButton);

        notificationList.appendChild(notificationItem);
        notificationCount++;
        updateNotificationCounter();
    }

    function updateNotificationCounter() {
        if (notificationCount > 0) {
            notificationCounter.textContent = notificationCount;
            notificationCounter.style.display = 'block';
        } else {
            notificationCounter.style.display = 'none';
        }
    }

    window.createNotification = createNotification;

    document.getElementById("clear-notifications").addEventListener("click", function() {
        notificationList.innerHTML = '';
        notificationCounter.style.display = 'none';
    });
    
    });
