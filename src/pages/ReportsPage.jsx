import React from 'react';

const ReportsPage = ({ breakdownData, productionRecords }) => {
    const totalMaintenanceCost = (breakdownData || [])
        .filter(wo => wo.status === 'CLOSE' && wo.rfuDetails?.totalCost)
        .reduce((sum, wo) => sum + wo.rfuDetails.totalCost, 0);

    const totalProductionQty = (productionRecords || [])
        .reduce((sum, rec) => sum + rec.quantity, 0);

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6">Reports Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-800 p-6 rounded-lg">
                    <h3 className="text-gray-400 text-lg">Total Maintenance Cost</h3>
                    <p className="text-3xl font-bold text-green-400 mt-2">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalMaintenanceCost)}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">From all closed Work Orders</p>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg">
                    <h3 className="text-gray-400 text-lg">Total Production Quantity</h3>
                    <p className="text-3xl font-bold text-blue-400 mt-2">
                        {new Intl.NumberFormat('id-ID').format(totalProductionQty)} Ton/BCM
                    </p>
                    <p className="text-sm text-gray-500 mt-1">From all production activities</p>
                </div>
            </div>
        </div>
    );
};

export default ReportsPage;