<?php

use App\Http\Controllers\Api\ActivityController;
use App\Http\Controllers\Api\ArtworkController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DeliveryRequestController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\QuotationController;
use App\Http\Controllers\Api\QuotationMessageController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\WarehouseController;
use App\Http\Middleware\AuthenticateApiToken;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::get('/artworks/{artwork}/media/{index}', [ArtworkController::class, 'media']);

Route::middleware(AuthenticateApiToken::class)->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me', [AuthController::class, 'updateProfile']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::get('/activity', [ActivityController::class, 'index']);

    Route::get('/settings/mail', [SettingsController::class, 'mail']);
    Route::put('/settings/mail', [SettingsController::class, 'updateMail']);
    Route::post('/settings/mail/test', [SettingsController::class, 'testMail']);

    Route::apiResource('customers', CustomerController::class);
    Route::apiResource('users', UserController::class);
    Route::apiResource('warehouses', WarehouseController::class);
    Route::get('/warehouses/{warehouse}/stocks', [WarehouseController::class, 'stocks']);
    Route::get('/warehouse-stocks', [WarehouseController::class, 'allStocks']);
    Route::get('/my-warehouse-stock', [WarehouseController::class, 'myStock']);

    Route::apiResource('products', ProductController::class);
    Route::apiResource('orders', OrderController::class);
    Route::post('/orders/{order}/advance', [OrderController::class, 'advance']);
    Route::post('/orders/{order}/artworks', [ArtworkController::class, 'storeForOrder']);

    Route::apiResource('invoices', InvoiceController::class);
    Route::post('/invoices/{invoice}/mark-paid', [InvoiceController::class, 'markPaid']);
    Route::post('/invoices/{invoice}/downloaded', [InvoiceController::class, 'downloaded']);
    Route::apiResource('artworks', ArtworkController::class);

    Route::apiResource('quotations', QuotationController::class);
    Route::post('/quotations/{quotation}/send', [QuotationController::class, 'send']);
    Route::post('/quotations/{quotation}/approve', [QuotationController::class, 'approve']);
    Route::post('/quotations/{quotation}/reject', [QuotationController::class, 'reject']);
    Route::get('/quotations/{quotation}/messages', [QuotationMessageController::class, 'index']);
    Route::post('/quotations/{quotation}/messages', [QuotationMessageController::class, 'store']);

    Route::get('/delivery-requests', [DeliveryRequestController::class, 'index']);
    Route::post('/delivery-requests', [DeliveryRequestController::class, 'store']);
    Route::get('/delivery-requests/{deliveryRequest}', [DeliveryRequestController::class, 'show']);
    Route::post('/delivery-requests/{deliveryRequest}/fulfill', [DeliveryRequestController::class, 'fulfill']);
    Route::post('/delivery-requests/{deliveryRequest}/reject', [DeliveryRequestController::class, 'reject']);
});
