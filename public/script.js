$(document).ready(function() {
    let cart = [];

    // Add to cart
    $('.mealsContainer').on('click', '.addButton', function () {
        const mealItem = $(this).closest('.mealItem');
        const mealName = mealItem.find('.mealName').text();
        const price = parseInt(mealItem.find('.price').text().replace('TL', '').trim());
        const mealId = mealItem.data('id');  // Get unique mealId
        
        // Check if meal is already in the cart, if so, update quantity
        const existingMealIndex = cart.findIndex(item => item.id === mealId);
        if (existingMealIndex !== -1) {
            cart[existingMealIndex].quantity++;  // Increase quantity if the meal is already in the cart
        } else {
            cart.push({ id: mealId, name: mealName, price: price, quantity: 1 });  // Add new item to cart
        }

        updateCartDisplay();
    });

    function updateCartDisplay() {
        $('#cartItems').empty();
        let total = 0;

        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;

            $('#cartItems').append(`
                <div class="cart-item">
                    <span>${item.name} x${item.quantity}</span>
                    <span>${itemTotal} TL</span>
                </div>
            `);
        });

        $('#totalAmount').text(`${total} TL`);
        $('.cartEmptyState').toggle(cart.length === 0);
        $('#cartTotal').toggle(cart.length > 0);
    }

    $('.confirmButton').click(function () {
        if (cart.length === 0) return;
    
        const branchId = $('#branchDropdown').val();
        if (!branchId) {
            alert("Please select a branch.");
            return;
        }
    
        // Show customer input modal
        $('#customerModal').show();
    });
    
    // Cancel the modal
    $('#cancelCustomerModal').click(() => $('#customerModal').hide());
    
    // Final confirmation with customer info
    $('#finalConfirmButton').click(async function () {
        const name = $('#customerName').val().trim();
        const phone = $('#customerPhone').val().trim();
        const branchId = $('#branchDropdown').val();
    
        if (!name || !phone) {
            alert("Please enter both name and phone.");
            return;
        }
    
        const response = await fetch("http://localhost:3007/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cart, branchId, name, phone })
        });
    
        if (response.ok) {
            alert("Order confirmed!");
            cart = [];
            updateCartDisplay();
            $('#customerModal').hide();
            $('#customerName').val('');
            $('#customerPhone').val('');
        } else {
            alert("Failed to confirm order.");
        }
    });
    
    
    

    function fetchMeals() {
        $.ajax({
            url: "http://localhost:3007/meals", // Your backend API
            method: "GET",
            success: function(mealsByCategory) {
                for (const category in mealsByCategory) {
                    let categoryId = category.replace(/\s+/g, ""); // Remove spaces for IDs
                    let categorySection = $(`#${categoryId}`);
    
                    mealsByCategory[category].forEach(meal => {
                        const mealItem = `
                            <div class="mealItem" data-id="${meal.id}">
                                <img src="imgs/logo.png" alt="${meal.name}" class="mealImage">
                                <div class="mealDetails">
                                    <span class="mealName">${meal.name}</span>
                                    <span class="price">${meal.price} TL</span>
                                </div>
                                <button class="addButton">+</button>
                            </div>
                        `;
                        categorySection.next(".mealItems").append(mealItem);
                    });
                }
            },
            error: function(err) {
                console.error("Error fetching meals:", err);
            }
        });
    }    

    fetchMeals(); // Load meals when the page loads

    $.ajax({
        url: "http://localhost:3007/branches", // The endpoint for fetching branch info
        method: "GET",
        success: function(branches) {
            const branchDropdown = $('#branchDropdown');
            branchDropdown.empty(); // Clear existing options
    
            // Add a default "Select" option
            branchDropdown.append('<option value="">Select Branch</option>');
    
            // Dynamically add each branch with its ID as value
            branches.forEach(branch => {
                branchDropdown.append(`<option value="${branch.branch_id}">${branch.name}</option>`);
            });
        },
        error: function(err) {
            console.error("Error fetching branches:", err);
        }
    });

    $('#ordersLink').click(function (e) {
        e.preventDefault();
        fetchOrders();
    });

    $('#closeOrdersBtn').click(function () {
        $('#ordersModal').hide();
    });

    function fetchOrders() {
        $.ajax({
            url: 'http://localhost:3007/orders',
            method: 'GET',
            success: function (orders) {
                $('#ordersContent').empty();
                orders.forEach(order => {
                    const itemsHtml = order.order_items.map(item =>
                        `<li>${item.item_name} - ${item.quantity} x ${item.item_price} TL</li>`
                    ).join('');

                    const orderHtml = `
                        <div class="order-box" style="border: 1px solid #ddd; margin: 15px; padding: 10px;
                            border-radius: 5px; background: #f9f9f9;
                            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
                            width: 100%; max-width: 300px; display: inline-block;
                            vertical-align: top; max-height: 230px; overflow-y: auto;
                            position: relative;">
                            <h4>Order #${order.order_id}</h4>
                            <p><strong>Customer:</strong> ${order.customer_name} (${order.customer_phone})</p>
                            <p><strong>Branch:</strong> ${order.branch_name}</p>
                            <p><strong>Total:</strong> ${order.total_price} TL</p>
                            <ul>${itemsHtml}</ul>
                            <button class="deleteOrderBtn" data-id="${order.order_id}" style="margin-top: 10px; background: #e74c3c; 
                            color: #fff; border: none; padding: 5px 10px; cursor: pointer;
                             position: absolute; top: 18px; right: 10px;">Delete Order</button>
                        </div>
                    `;
                    $('#ordersContent').append(orderHtml);
                });
                $('#ordersModal').show();
            },
            error: function (err) {
                console.error("Failed to fetch orders:", err);
                alert("Failed to load past orders.");
            }
        });
    }

    // Open modal
$('#reservationButton').click(async function () {
    $('#reservationModal').show();
    await loadBranches();
    await loadReservations();
  });

  // Close modal
  $('#closeResBtn').click(function () {
    $('#reservationModal').hide();
  });

  // Load reservations
  async function loadReservations() {
    const res = await fetch('http://localhost:3007/reservations');
    const reservations = await res.json();
    const container = $('#reservationList');
    container.empty();

    if (reservations.length === 0) {
      container.append('<p>No reservations yet.</p>');
      return;
    }

    reservations.forEach(r => {
      const html = `
        <div class="reservationItem " style="border: 1px solid #ddd; margin: 15px; padding: 10px;
            border-radius: 5px; background: #f9f9f9;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            width: 100%; max-width: 300px; display: inline-block;
            vertical-align: top; max-height: 230px; overflow-y: auto;">
          <strong>${r.customer_name}</strong> - ${r.customer_phone}<br>
          Branch: ${r.branch_name} | People: ${r.number_of_people}<br>
          Time: ${new Date(r.reservation_time).toLocaleString()}
        </div>
      `;
      container.append(html);
    });
  }

  // Load branch options
  async function loadBranches() {
    const res = await fetch('http://localhost:3007/branches');
    const branches = await res.json();
    const dropdown = $('#resBranch');
    dropdown.empty();
    branches.forEach(branch => {
      dropdown.append(`<option value="${branch.branch_id}">${branch.name}</option>`);
    });
  }

  // Submit new reservation
  $('#reservationForm').submit(async function (e) {
    e.preventDefault();

    const data = {
      name: $('#resCustomerName').val(),
      phone: $('#resCustomerPhone').val(),
      branchId: $('#resBranch').val(),
      reservationTime: $('#resTime').val(),
      numberOfPeople: $('#resPeople').val()
    };

    const res = await fetch('http://localhost:3007/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      alert('Reservation confirmed!');
      $('.overlay').fadeOut();
      $('#reservationForm')[0].reset();
      await loadReservations();
    } else {
      alert('Failed to confirm reservation.');
    }
  });

  // Open modal when SERVICE HOURS is clicked
  $('#serviceHoursButton').click(async function () {
    $('#serviceHoursModal').show();
    await loadServiceHours();
  });

  // Close modal
  $('#serviceHoursModal .close-btn').click(function () {
    $('#serviceHoursModal').hide();
  });

  // Load service hours from backend
  async function loadServiceHours() {
    const res = await fetch('http://localhost:3007/branches/hours');
    const data = await res.json();
    const container = $('#serviceHoursContent');
    container.empty();

    if (data.length === 0) {
      container.append('<p>No service hours available.</p>');
      return;
    }

    data.forEach(branch => {
      container.append(`
        <div style="margin-bottom: 15px;
          padding: 10px; border: 1px solid #ddd; border-radius: 5px;
          background: #f9f9f9; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);">
          <strong>${branch.name}</strong><br>
          Hours: ${branch.opening_hours}
          
        </div>
      `);
    });
  }

    // Use event delegation to handle delete button clicks
    $('#ordersContent').on('click', '.deleteOrderBtn', function () {
        const orderId = $(this).data('id');
        if (confirm(`Are you sure you want to delete Order #${orderId}?`)) {
            deleteOrder(orderId);
        }
    });


    function deleteOrder(orderId) {
        $.ajax({
            url: `http://localhost:3007/orders/${orderId}`,
            method: 'DELETE',
            success: function () {
                alert(`Order #${orderId} deleted.`);
                fetchOrders(); // Refresh list
            },
            error: function (err) {
                console.error("Delete error:", err);
                alert("Failed to delete the order.");
            }
        });
    }
    
    $(document).ready(function () {
        $('#addResBtn').click(function () {
            // Show the overlay
            $('.overlay').fadeIn().css('display', 'flex');
        });
    
        // Close the overlay when clicking outside the content
        $('.overlay').click(function (e) {
            if ($(e.target).is('.overlay')) {
                $('.overlay').fadeOut();
            }
        });
    });
    
});
