import React, { useState } from 'react';

const SparePartCatalogPage = ({ catalog, onAddSparePart, onDeleteSparePart }) => {
  const [newPart, setNewPart] = useState({ partNo: '', name: '', price: '', unit: '' });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewPart(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newPart.partNo && newPart.name && newPart.price && newPart.unit) {
      onAddSparePart({ ...newPart, price: parseFloat(newPart.price) });
      setNewPart({ partNo: '', name: '', price: '', unit: '' });
    } else {
      alert('Please fill all fields.');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Spare Part Catalog</h2>
      
      {/* Form Tambah Spare Part */}
      <form onSubmit={handleSubmit} className="bg-gray-800 p-4 rounded-lg mb-6 flex gap-4 items-end">
        {/* ... form inputs for partNo, name, price, unit ... */}
        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-md h-fit">Add Part</button>
      </form>

      {/* Tabel Daftar Spare Part */}
      <div className="overflow-x-auto bg-gray-800 rounded-lg p-4">
        {/* ... table to display spare parts ... */}
      </div>
    </div>
  );
};

export default SparePartCatalogPage;