import React, { useState } from 'react';

const UnitManagementPage = ({ units, onAddUnit, onDeleteUnit }) => {
  const [newUnit, setNewUnit] = useState({ id: '', name: '', type: '', costPerHour: '' });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewUnit(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newUnit.id && newUnit.name && newUnit.type && newUnit.costPerHour) {
      onAddUnit({ ...newUnit, costPerHour: parseFloat(newUnit.costPerHour) });
      setNewUnit({ id: '', name: '', type: '', costPerHour: '' }); // Reset form
    } else {
      alert('Please fill all fields.');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Unit Management</h2>
      
      {/* Form Tambah Unit */}
      <form onSubmit={handleSubmit} className="bg-gray-800 p-4 rounded-lg mb-6 flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-400">Unit ID</label>
          <input type="text" name="id" value={newUnit.id} onChange={handleInputChange} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md p-2" required />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-400">Unit Name/Model</label>
          <input type="text" name="name" value={newUnit.name} onChange={handleInputChange} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md p-2" required />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-400">Type</label>
          <input type="text" name="type" value={newUnit.type} onChange={handleInputChange} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md p-2" required />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-400">Cost/Hour (Rp)</label>
          <input type="number" name="costPerHour" value={newUnit.costPerHour} onChange={handleInputChange} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md p-2" required />
        </div>
        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-md h-fit">Add Unit</button>
      </form>

      {/* Tabel Daftar Unit */}
      <div className="overflow-x-auto bg-gray-800 rounded-lg p-4">
        <table className="min-w-full text-sm text-left">
           <thead className="text-xs text-gray-400 uppercase bg-gray-700">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Name/Model</th>
                <th className="p-3">Type</th>
                <th className="p-3">Cost/Hour</th>
                <th className="p-3">Action</th>
              </tr>
           </thead>
           <tbody>
              {(units || []).map(unit => (
                <tr key={unit.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                  <td className="p-3 font-medium">{unit.id}</td>
                  <td className="p-3">{unit.name}</td>
                  <td className="p-3">{unit.type}</td>
                  <td className="p-3">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(unit.costPerHour)}</td>
                  <td className="p-3">
                      <button onClick={() => onDeleteUnit(unit.id)} className="text-red-400 hover:text-red-300 font-semibold">Delete</button>
                  </td>
                </tr>
              ))}
           </tbody>
        </table>
      </div>
    </div>
  );
};

export default UnitManagementPage;