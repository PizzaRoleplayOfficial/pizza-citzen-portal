const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

const start = lines.findIndex(l => l.includes(') : ('));
const end = lines.findIndex((l, i) => i > start && l.trim() === ');' && lines[i-1].trim() === '</div>');

const replacement = [
  '          <AdminDashboardView',
  '            isMobile={isMobile}',
  '            showMobileMenu={showMobileMenu}',
  '            setShowMobileMenu={setShowMobileMenu}',
  '            adminTab={adminTab}',
  '            setAdminTab={setAdminTab}',
  '            stats={stats}',
  '            vehicles={vehicles}',
  '            users={users}',
  '            applications={applications}',
  '            isLoading={isLoading}',
  '            handleManualRefresh={handleManualRefresh}',
  '            handleDeleteVehicle={handleDeleteVehicle}',
  '            handleUpdateVehicleStatus={handleUpdateVehicleStatus}',
  '            setApplications={setApplications}',
  '            setUsers={setUsers}',
  '            questions={questions}',
  '            setQuestions={setQuestions}',
  '            searchQuery={searchQuery}',
  '            setSearchQuery={setSearchQuery}',
  '            searchFilter={searchFilter}',
  '            setSearchFilter={setSearchFilter}',
  '            allSearchVehicles={allSearchVehicles}',
  '            searchLoading={searchLoading}',
  '            handleAdminSearch={handleAdminSearch}',
  '            setEditingVehicleId={setEditingVehicleId}',
  '            setShowAddModal={setShowAddModal}',
  '            setFormData={setFormData}',
  '            trailerFormData={trailerFormData}',
  '            setTrailerFormData={setTrailerFormData}',
  '            setShowTrailerModal={setShowTrailerModal}',
  '            adminGarageViewMode={adminGarageViewMode}',
  '            setAdminGarageViewMode={setAdminGarageViewMode}',
  '            adminUserViewMode={adminUserViewMode}',
  '            setAdminUserViewMode={setAdminUserViewMode}',
  '            handleApplicationAction={handleApplicationAction}',
  '            handleSaveUserRole={handleSaveUserRole}',
  '            setNewQuestion={setNewQuestion}',
  '            handleToggleMobileMenu={handleToggleMobileMenu ? handleToggleMobileMenu : undefined}',
  '          />'
];

lines.splice(start + 1, end - start - 1, ...replacement);
lines.splice(7, 0, 'import { AdminDashboardView } from \'./views/AdminDashboardView\';');

fs.writeFileSync('src/App.tsx', lines.join('\n'));
console.log('Spliced AdminDashboardView');
