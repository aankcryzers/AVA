import React from 'react';

const WorkOrderPage = ({ breakdownData, adminMode, handleEditRfu, handleDeleteWo, handleCloseWoClick }) => {
  const openWo = (breakdownData || []).filter(d => d.status === 'OPEN');
  const closeWo = (breakdownData || []).filter(d => d.status === 'CLOSE');

  const renderTable = (data, title) => (
    <div className='mb-8'>
      <h2 className="text-2xl font-bold mb-4 text-gray-200">{title}</h2>
      <div className="overflow-x-auto bg-gray-800 rounded-lg p-4">
        <table className="min-w-full text-sm text-left">
          <thead className="text-xs text-gray-400 uppercase bg-gray-700">
            <tr>
              <th className="p-3">WO Num</th>
              <th className="p-3">Unit</th>
              <th className="p-3">Komponen</th>
              <th className="p-3">Jam Lapor</th>
              <th className="p-3">Status</th>
              <th className="p-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.map(wo => (
              <tr key={wo.woNumber} className="border-b border-gray-700 hover:bg-gray-700/50">
                <td className="p-3 font-medium">{wo.woNumber}</td>
                <td className="p-3">{wo.unit}</td>
                <td className="p-3">{wo.komponen}</td>
                <td className="p-3">{new Date(wo.jamLapor).toLocaleString('id-ID')}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${wo.status === 'OPEN' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                    {wo.status}
                  </span>
                </td>
                <td className="p-3 flex gap-2">
                   {wo.status === 'OPEN' && (
                     <button onClick={() => handleCloseWoClick(wo)} className="text-green-400 hover:text-green-300 font-semibold">Close</button>
                   )}
                   {adminMode && (
                     <>
                        <button onClick={() => handleEditRfu(wo)} className="text-yellow-400 hover:text-yellow-300 font-semibold">Edit</button>
                        <button onClick={() => handleDeleteWo(wo.woNumber)} className="text-red-400 hover:text-red-300 font-semibold">Delete</button>
                     </>
                   )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      {renderTable(openWo, 'OPEN Breakdown')}
      {renderTable(closeWo, 'CLOSE Breakdown')}
    </div>
  );
};

export default WorkOrderPage;
