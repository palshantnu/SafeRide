/// <reference types="vite/client" />
import axios from "axios";
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
});
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
export const loginUser = (data: { email: string; password: string }) =>
  API.post("/login", data);
export const getMe = () => API.get("/admin/me"); // current admin + permissions
export const getAllUsers = () => API.get("/userlist");
export const createUser = (data: object) => API.post("/user", data);
export const updateUser = (id: string | number, data: object) =>API.put(`/user/${id}`, data);
export const deleteUser = (id: string | number) => API.delete(`/user/${id}`);
export const getAllDrivers = () => API.get(`/driverlist`);
export const getDriverById = (id: string | number) => API.get(`/drivers/${id}`);
export const getDriverBookings = (id: string | number) => API.get(`/drivers/${id}/bookings`);
export const getDriverDocuments = (id: string | number) => API.get(`/drivers/${id}/documents`);
export const verifyDriverDocument = (
  driverId: string | number,
  docId: string | number,
  data: { status: number; verified_by: number; remark: string }
) => API.patch(`/drivers/${driverId}/documents/${docId}/verify`, data);
export const updateDriver  = (id: string | number, data: object) => API.put(`/drivers/${id}`, data);
export const deleteDriver  = (id: string | number) => API.delete(`/drivers/${id}`);
export const createDriver   = (data: object) => API.post('/drivers', data);
export const createService   = (data: object) => API.post('/services', data);
export const getAllServices = (data?: object) => API.get('/allservices', data);
export const getServiceById = (id: string | number) => API.get(`/getServiceById/${id}`);
export const updateService = (id: any, data: any) => API.put(`/updateservices/${id}`, data);
export const toggleServiceStatus = (id: string | number, status: 0 | 1) => API.patch(`/servicestatus/${id}/status`, { status: status === 1 ? 0 : 1 });
export const deleteService = (id: string | number) => API.delete(`/servicedelete/${id}`);
export const getAllSubServices = () => API.get("/getsubservicelist").then((r) => r.data);
export const getSubByServiceId = (serviceId: string | number) => API.get(`/allsubservices/${serviceId}`).then((r) => r.data);
export const createSubService = (formData: FormData) =>
  API.post("/create-sub-services", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const updateSubService = (id: string | number, formData: FormData) =>
  API.put(`/update-sub-services/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
});
export const deleteSubService = (id: string | number) => API.delete(`/deleteSubService/${id}`);
export const toggleSubServiceStatus = (id: string | number) => API.patch(`/subservicestatus/${id}/status`);
export const getAllServiceDocuments = () =>API.get("/getAllServiceDocuments").then(r => r.data);

export const createServiceDocument = (data: { service_id: number | string; document_type: string })=>API.post("/createServiceDocument", data).then(r => r.data);
export const updateServiceDocument = (id: string | number, data: { service_id: number | string; document_type: string }) =>API.put(`/updateServiceDocument/${id}`, data).then(r => r.data);
export const deleteServiceDocument = (id: string | number) => API.delete(`/deleteServiceDocument/${id}`).then(r => r.data);

export const getAllbussinessassociates = ()  => API.get('bussinessassociates/list');
export const getBADrivers             = (baId: string | number) => API.get(`/ba/${baId}/drivers`);
export const getBADriverBookings      = (baId: string | number, driverId: string | number) => API.get(`/ba/${baId}/drivers/${driverId}/bookings`);
export const getBADriversWithBookings = (baId: string | number) => API.get(`/ba/${baId}/drivers-with-bookings`);
export const updateBussinessAssociate  = (id: number, data: object) => API.put(`ba/update/${id}`, data);
export const deleteBussinessAssociate  = (id: number)               => API.delete(`ba/delete/${id}`);

// Booking history — all support: status, service_id, from_date, to_date, search, page, limit
export const getAllBookinghistory    = (params?: Record<string, unknown>) => API.get('all/bookinghistory', { params });
export const getSelfSharingTrips    = (params?: Record<string, unknown>) => API.get('/admin/selfsharing/trips', { params });
export const getSelfSharingBookings = (params?: Record<string, unknown>) => API.get('/admin/selfsharing/bookings', { params });
export const getParcelBookings      = (params?: Record<string, unknown>) => API.get('/admin/parcel/bookings', { params });
export const getOnSpotBookings      = (params?: Record<string, unknown>) => API.get('/admin/onspot/bookings', { params });

// Withdrawal Requests
export const getWithdrawalRequests     = ()                                              => API.get('/admin/withdrawal-requests');
export const updateWithdrawalStatus    = (id: string | number, data: { status: string; remark?: string }) => API.patch(`/admin/withdrawal-requests/${id}/status`, data);
export const getAllPlans      = ()             => API.get('/allplans');
export const createPlan       = (fd: any)      => API.post('/createplan', fd);
export const updatePlan       = (id: any, fd: any) => API.put(`/updateplan/${id}`, fd);
export const deletePlan       = (id: any)      => API.delete(`/deleteplan/${id}`);
export const togglePlanStatus = (id: any, status: any) => API.patch(`/planstatus/${id}/status`, { status });

// Staff
export const getAllStaff          = ()                              => API.get('/admin/staff');
export const getStaffById         = (id: number | string)           => API.get(`/admin/staff/${id}`);
export const createStaff          = (data: object)                  => API.post('/admin/staff', data);
export const updateStaff          = (id: number | string, data: object) => API.put(`/admin/staff/${id}`, data);
export const deleteStaff          = (id: number | string)           => API.delete(`/admin/staff/${id}`);
export const assignStaffRole      = (id: number | string, role_id: number) => API.put(`/admin/staff/${id}/assign-role`, { role_id });

// Roles
export const getAllRoles           = ()                              => API.get('/admin/roles');
export const getRolePermissions    = (id: number | string)           => API.get(`/admin/roles/${id}/permissions`);
export const createRole           = (data: object)                  => API.post('/admin/roles', data);
export const updateRole           = (id: number | string, data: object) => API.put(`/admin/roles/${id}`, data);
export const deleteRole           = (id: number | string)           => API.delete(`/admin/roles/${id}`);
export const assignRolePermissions = (id: number | string, permission_ids: number[]) => API.post(`/admin/roles/${id}/permissions`, { permission_ids });

// Permissions
export const getAllPermissions     = (module?: string)              => API.get('/admin/permissions', { params: module ? { module } : undefined });
export const createPermission     = (data: object)                  => API.post('/admin/permissions', data);
export const seedPermissions       = ()                              => API.post('/admin/permissions/seed');       // idempotent: creates module×action grid
export const getPermissionMatrix   = (roleId?: number | string)      => API.get(roleId ? `/admin/permission-matrix/${roleId}` : '/admin/permission-matrix');

// States & Cities
export const getStates       = (params?: Record<string, unknown>) => API.get('/admin/states', { params });
export const createState     = (data: object)                  => API.post('/admin/states', data);
export const updateState     = (id: number | string, data: object) => API.put(`/admin/states/${id}`, data);
export const deleteState     = (id: number | string)           => API.delete(`/admin/states/${id}`);
export const getCities       = (params?: Record<string, unknown>) => API.get('/admin/cities', { params });
export const createCity      = (data: object)                  => API.post('/admin/cities', data);
export const updateCity      = (id: number | string, data: object) => API.put(`/admin/cities/${id}`, data);
export const deleteCity      = (id: number | string)           => API.delete(`/admin/cities/${id}`);

// Contact / enquiry
export const submitContact       = (data: object)              => API.post('/contact', data);            // public
export const getContacts         = ()                          => API.get('/admin/contacts');
export const updateContactStatus = (id: string | number, status: 0 | 1) => API.patch(`/admin/contacts/${id}/status`, { status });
export const deleteContact       = (id: string | number)       => API.delete(`/admin/contacts/${id}`);

// Generic image upload → { url }
export const uploadImage               = (fd: FormData)              => API.post('/admin/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });

// Landing Page (section-based CMS)
export const getLandingPage            = ()                          => API.get('/landing');                       // public: active sections + byKey map
export const getLandingSections        = ()                          => API.get('/admin/landing');                 // admin: all sections
export const getLandingSection         = (id: string | number)       => API.get(`/admin/landing/${id}`);
export const createLandingSection      = (fd: FormData)              => API.post('/admin/landing', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateLandingSection      = (id: string | number, fd: FormData) => API.put(`/admin/landing/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
export const toggleLandingSectionStatus = (id: string | number, status: 0 | 1) => API.patch(`/admin/landing/${id}/status`, { status });
export const reorderLandingSections    = (order: { id: number; sort_order: number }[]) => API.patch('/admin/landing/reorder', { order });
export const deleteLandingSection      = (id: string | number)       => API.delete(`/admin/landing/${id}`);

// Pop-up Messages (CMS) — audience: 'user' | 'captain' | 'both'
export const getPopupsByAudience   = (audience: 'user' | 'captain') => API.get(`/popups/${audience}`); // public
export const getAllPopups          = ()                          => API.get('/admin/popups');
export const getPopupById          = (id: string | number)       => API.get(`/admin/popups/${id}`);
export const createPopup           = (fd: FormData)              => API.post('/admin/popups', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updatePopup           = (id: string | number, fd: FormData) => API.put(`/admin/popups/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
export const togglePopupStatus     = (id: string | number, status: 0 | 1) => API.patch(`/admin/popups/${id}/status`, { status });
export const deletePopup           = (id: string | number)       => API.delete(`/admin/popups/${id}`);

// Notifications (CMS) — audience: 'user' | 'captain' | 'both'
export const getNotificationsByAudience = (audience: 'user' | 'captain') => API.get(`/notifications/${audience}`); // public
export const getAllNotifications        = ()                          => API.get('/admin/notifications');
export const getNotificationById        = (id: string | number)       => API.get(`/admin/notifications/${id}`);
export const createNotification         = (fd: FormData)              => API.post('/admin/notifications', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateNotification         = (id: string | number, fd: FormData) => API.put(`/admin/notifications/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
export const toggleNotificationStatus   = (id: string | number, status: 0 | 1) => API.patch(`/admin/notifications/${id}/status`, { status });
export const deleteNotification         = (id: string | number)       => API.delete(`/admin/notifications/${id}`);

// App Settings — Slider Banners (home slider shown in the mobile app)
export const getAppBanners         = ()                          => API.get('/app-banners');          // public: active banners for the app
export const getAllAppBanners      = ()                          => API.get('/admin/app-banners');
export const createAppBanner       = (fd: FormData)              => API.post('/admin/app-banners', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateAppBanner       = (id: string | number, fd: FormData) => API.put(`/admin/app-banners/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
export const toggleAppBannerStatus = (id: string | number, status: 0 | 1) => API.patch(`/admin/app-banners/${id}/status`, { status });
export const deleteAppBanner       = (id: string | number)       => API.delete(`/admin/app-banners/${id}`);

export const getAllPages      = ()                              => API.get('/pages');
export const getPageBySlug   = (slug: string)                  => API.get(`/pages/slug/${slug}`);
export const getPageById     = (id: number | string)           => API.get(`/pages/${id}`);
export const createPage      = (data: object)                  => API.post('/pages', data);
export const updatePage      = (id: number | string, data: object) => API.put(`/pages/${id}`, data);
export const deletePage      = (id: number | string)           => API.delete(`/pages/${id}`);
export const togglePageStatus = (id: number | string, status: number) => API.patch(`/pages/${id}/status`, { status });
