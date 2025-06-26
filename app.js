import React, { useState, useEffect, useCallback } from 'react';
// XLSX will be loaded globally via CDN in index.html, no import needed here.

// Utility for parsing/formatting Rupiah
const formatRupiah = (x) => {
  x = typeof x === "number" ? x : parseRupiah(x);
  if (!x) return "Rp 0";
  return "Rp " + x.toLocaleString('id-ID');
};

const parseRupiah = (val) => {
  if (typeof val === 'number') return val;
  return Number((val || "").toString().replace(/[^,\d]/g, '').replace(/,/g, '.')) || 0;
};

// Utility to calculate duration in minutes
const calculateDuration = (jamMulai, jamSelesai) => {
  if (!jamMulai || !jamSelesai) return "";
  let [sh, sm] = jamMulai.split(":").map(x => parseInt(x));
  let [eh, em] = jamSelesai.split(':').map(x => parseInt(x));
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // Handle overnight duration (e.g., 23:00 to 01:00)
  return mins;
};

// --- Helper function to fetch dropdown data (moved to top and using .then().catch()) ---
function fetchDropdown(url, fallback) {
  return fetch(url)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      return Array.isArray(data) ? data : fallback;
    })
    .catch(e => {
      console.error("Failed to fetch dropdown data:", e);
      return fallback;
    });
}

// Constants for Local Storage Keys and API
const FORM_KEY = "bd_monitoring_local";
const WO_COUNTER_KEY = "bd_wo_counter";
const SUGGEST_KEY = "bd_wo_suggest";
const SPARE_PART_KEY = "bd_spare_parts_catalog";
const PRODUCTION_KEY = "bd_production_records";
const UNITS_KEY = "bd_units_data"; // New key for units managed locally

const SPREADSHEET_API = {
  // We will load initial units from this API, then manage them locally
  units: 'https://raw.githubusercontent.com/aankcryzers/Monitoring-Breakdown/main/unit.json'
};

// --- Main App Component ---
function App() { // Changed to function declaration
  const [breakdownData, setBreakdownData] = useState([]);
  const [suggestData, setSuggestData] = useState({});
  const [currentWoNo, setCurrentWoNo] = useState('');
  const [units, setUnits] = useState([]); // Now managed locally, can be extended
  const [sparePartsCatalog, setSparePartsCatalog] = useState([]); // New state for spare parts
  const [productionRecords, setProductionRecords] = useState([]); // New state for production records

  const [activeModal, setActiveModal] = useState(null); // 'formWO', 'closeWO', 'loginEdit', 'editWO'
  const [selectedWoIndex, setSelectedWoIndex] = useState(null);
  const [manpowerClose, setManpowerClose] = useState([]);
  const [materialClose, setMaterialClose] = useState([]);
  const [manpowerEdit, setManpowerEdit] = useState([]);
  const [materialEdit, setMaterialEdit] = useState([]);
  const [loginError, setLoginError] = useState(false);
  const [globalMessage, setGlobalMessage] = useState(''); // Untuk pesan notifikasi singkat
  const [currentPage, setCurrentPage] = useState('workOrder'); // 'workOrder', 'spareParts', 'production', 'reports', 'unitManagement'

  // --- Load Data and Initialize on Mount ---
  useEffect(() => {
    // Load breakdown data
    try {
      const storedData = JSON.parse(localStorage.getItem(FORM_KEY) || "[]");
      setBreakdownData(Array.isArray(storedData) ? storedData : []);
    } catch (e) {
      console.error("Failed to load breakdown data:", e);
      setBreakdownData([]);
    }

    // Load suggestion data
    try {
      const storedSuggest = JSON.parse(localStorage.getItem(SUGGEST_KEY) || '{}');
      setSuggestData({
        komponen: storedSuggest.komponen || [],
        subkomponen: storedSuggest.subkomponen || [],
        manpower: storedSuggest.manpower || [],
        material: storedSuggest.material || [],
      });
    } catch (e) {
      console.error("Failed to load suggestion data:", e);
      setSuggestData({ komponen: [], subkomponen: [], manpower: [], material: [] });
    }

    // Load spare parts catalog
    try {
      const storedSpareParts = JSON.parse(localStorage.getItem(SPARE_PART_KEY) || "[]");
      setSparePartsCatalog(Array.isArray(storedSpareParts) ? storedSpareParts : []);
    } catch (e) {
      console.error("Failed to load spare parts catalog:", e);
      setSparePartsCatalog([]);
    }

    // Load production records
    try {
      const storedProduction = JSON.parse(localStorage.getItem(PRODUCTION_KEY) || "[]");
      setProductionRecords(Array.isArray(storedProduction) ? storedProduction : []);
    } catch (e) {
      console.error("Failed to load production records:", e);
      setProductionRecords([]);
    }

    // Load units data, prioritize local storage, then fetch from API if not found
    const loadUnits = () => {
        const storedUnits = JSON.parse(localStorage.getItem(UNITS_KEY) || "[]");
        if (storedUnits.length > 0) {
            setUnits(Array.isArray(storedUnits) ? storedUnits : []);
        } else {
            // If no local units, fetch initial units from API
            fetchDropdown(SPREADSHEET_API.units, [
                { unit: "BSS-75", unit_code: "BSS-75", type: "DUMP TRUCK", costPerOperationalHour: 100000 },
                { unit: "EX7-43", unit_code: "EX7-43", type: "A2B", costPerOperationalHour: 150000 },
                { unit: "LT-01", unit_code: "LT-01", type: "SUPPORT", costPerOperationalHour: 50000 }
            ]).then(fetchedUnits => {
                setUnits(Array.isArray(fetchedUnits) ? fetchedUnits : []); // Ensure it's always an array
                localStorage.setItem(UNITS_KEY, JSON.stringify(fetchedUnits)); // Save fetched units to local storage
            });
        }
    };
    loadUnits();

    // Set initial WO number
    getNextWoNumber();
  }, []); // Run only once on component mount

  // --- Save Data to Local Storage whenever it changes ---
  useEffect(() => {
    localStorage.setItem(FORM_KEY, JSON.stringify(breakdownData));
  }, [breakdownData]);

  useEffect(() => {
    localStorage.setItem(SUGGEST_KEY, JSON.stringify(suggestData));
  }, [suggestData]);

  useEffect(() => {
    localStorage.setItem(SPARE_PART_KEY, JSON.stringify(sparePartsCatalog));
  }, [sparePartsCatalog]);

  useEffect(() => {
    localStorage.setItem(PRODUCTION_KEY, JSON.stringify(productionRecords));
  }, [productionRecords]);

  useEffect(() => {
    localStorage.setItem(UNITS_KEY, JSON.stringify(units));
  }, [units]);

  // Clear global message after a few seconds
  useEffect(() => {
    if (globalMessage) {
      const timer = setTimeout(() => {
        setGlobalMessage('');
      }, 3000); // Pesan akan hilang setelah 3 detik
      return () => clearTimeout(timer);
    }
  }, [globalMessage]);


  // --- Suggestion Handling ---
  const addSuggest = useCallback((type, value) => {
    if (!value || typeof value !== 'string') return;
    setSuggestData(prev => {
      if (!prev[type].includes(value)) {
        return { ...prev, [type]: [...prev[type], value] };
      }
      return prev;
    });
  }, []);

  // --- WO Number Logic ---
  const getNextWoNumber = useCallback(() => {
    let counter = Number(localStorage.getItem(WO_COUNTER_KEY) || "1");
    const nextWO = "WO-" + String(counter).padStart(5, "0");
    setCurrentWoNo(nextWO);
    return nextWO;
  }, []);

  const incrementWoCounter = useCallback(() => {
    let counter = Number(localStorage.getItem(WO_COUNTER_KEY) || "1");
    localStorage.setItem(WO_COUNTER_KEY, counter + 1);
  }, []);

  // --- Form WO Submission ---
  const handleFormWOSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const newWO = {
      nowo: currentWoNo,
      tanggal: fd.get("tanggal"),
      unit: fd.get("unit"),
      type: fd.get("type"),
      jamMulai: fd.get("jamMulai"),
      komponen: fd.get("komponen"),
      subkomponen: fd.get("subkomponen"),
      deskripsi: fd.get("deskripsi"),
      statusPekerjaan: fd.get("statusPekerjaan"),
      descPekerjaan: "",
      manpowerArr: [],
      materialArr: [],
      status: "OPEN", // Default status for new WO
      durasiMenit: "",
      jamSelesai: "",
    };

    addSuggest('komponen', newWO.komponen);
    addSuggest('subkomponen', newWO.subkomponen);

    setBreakdownData(prev => [newWO, ...prev]); // Add new WO to the beginning
    incrementWoCounter();
    getNextWoNumber(); // Update WO number for next form
    setActiveModal(null); // Close modal
    setGlobalMessage(`WO ${newWO.nowo} berhasil dibuat.`);
    e.target.reset(); // Reset form
  };

  // --- Close WO Modal Handlers ---
  const openCloseWOModal = useCallback((idx) => {
    setSelectedWoIndex(idx);
    const wo = breakdownData[idx];
    setManpowerClose([...(wo.manpowerArr || [])]);
    setMaterialClose([...(wo.materialArr || [])]);
    const closeTimeInput = document.getElementById('inputCloseTime');
    if (closeTimeInput) closeTimeInput.value = wo.jamSelesai || '';
    const descPekerjaanInput = document.getElementById('inputDescPekerjaanClose');
    if (descPekerjaanInput) descPekerjaanInput.value = wo.descPekerjaan || '';
    setActiveModal('closeWO');
  }, [breakdownData]);

  const handleAddManpowerClose = () => {
    const input = document.getElementById("formManpowerInputClose");
    let val = input.value.trim();
    if (!val) {
      setGlobalMessage('Manpower tidak boleh kosong.');
      return;
    }
    if (manpowerClose.includes(val)) {
      setGlobalMessage('Manpower ini sudah ditambahkan.');
      return;
    }
    setManpowerClose(prev => [...prev, val]);
    addSuggest('manpower', val);
    if (input) input.value = "";
  };

  const handleDeleteManpowerClose = (idx) => {
    setManpowerClose(prev => prev.filter((_, i) => i !== idx));
    setGlobalMessage('Manpower dihapus.');
  };

  const handleAddMaterialClose = () => {
    const materialInput = document.getElementById('formMaterialInputClose');
    const qtyInput = document.getElementById('inputQtyClose');
    const satuanInput = document.getElementById('inputSatuanClose');
    const hargaInput = document.getElementById('inputHargaClose');
    const statusMaterialInput = document.getElementById('inputStatusMaterialClose');
    const partnoInput = document.getElementById('inputPartNoClose');

    const material = materialInput ? materialInput.value.trim() : '';
    const qty = qtyInput ? Number(qtyInput.value) : 0;
    const satuan = satuanInput ? satuanInput.value : '';
    const harga = hargaInput ? parseRupiah(hargaInput.value) : 0;
    const totalHarga = harga * qty;
    const statusMaterial = statusMaterialInput ? statusMaterialInput.value : '';
    const partno = partnoInput ? partnoInput.value.trim() : '';

    if (!material || qty <= 0 || !satuan) {
      setGlobalMessage("Harap isi Sparepart, Qty, dan Satuan dengan benar.");
      return;
    }

    setMaterialClose(prev => [...prev, { material, qty, satuan, harga, totalHarga, statusMaterial, partno }]);
    addSuggest('material', material);
    if (materialInput) materialInput.value = "";
    if (qtyInput) qtyInput.value = "1";
    if (partnoInput) partnoInput.value = "";
    if (satuanInput) satuanInput.value = "pcs";
    if (hargaInput) hargaInput.value = formatRupiah(0);
    const totalHargaDisplay = document.getElementById('inputTotalHargaClose');
    if (totalHargaDisplay) totalHargaDisplay.value = formatRupiah(0);
    if (statusMaterialInput) statusMaterialInput.value = "Terinstal";
    setGlobalMessage('Sparepart ditambahkan.');
  };

  const handleDeleteMaterialClose = (idx) => {
    setMaterialClose(prev => prev.filter((_, i) => i !== idx));
    setGlobalMessage('Sparepart dihapus.');
  };

  const updateFormTotalHargaClose = () => {
    const qtyInput = document.getElementById("inputQtyClose");
    const hargaInput = document.getElementById("inputHargaClose");
    const totalHargaOutput = document.getElementById("inputTotalHargaClose");

    const qty = Number(qtyInput ? qtyInput.value : "0");
    const harga = parseRupiah(hargaInput ? hargaInput.value : "0");
    if (totalHargaOutput) totalHargaOutput.value = formatRupiah(harga * qty);
  };

  const handleCloseWOSubmit = () => {
    if (selectedWoIndex === null) return;
    const timeInput = document.getElementById('inputCloseTime');
    const descPekerjaanInput = document.getElementById('inputDescPekerjaanClose');

    const time = timeInput ? timeInput.value : '';
    const descPekerjaan = descPekerjaanInput ? descPekerjaanInput.value.trim() : '';

    if (!time) { setGlobalMessage("Isi jam selesai!"); return; }
    if (!descPekerjaan) { setGlobalMessage("Isi Deskripsi Pekerjaan!"); return; }

    setBreakdownData(prev => prev.map((wo, idx) => {
      if (idx === selectedWoIndex) {
        const durasi = calculateDuration(wo.jamMulai, time);
        return {
          ...wo,
          jamSelesai: time,
          descPekerjaan: descPekerjaan,
          durasiMenit: durasi,
          status: "RFU",
          manpowerArr: manpowerClose,
          materialArr: materialClose,
        };
      }
      return wo;
    }));

    manpowerClose.forEach(mp => addSuggest('manpower', mp));
    materialClose.forEach(m => addSuggest('material', m.material));

    setActiveModal(null);
    setSelectedWoIndex(null);
    setGlobalMessage(`WO ${breakdownData[selectedWoIndex]?.nowo || ''} berhasil ditutup (RFU).`);
  };

  // --- Edit WO Modal Handlers ---
  const openEditWOModal = useCallback((idx) => {
    setSelectedWoIndex(idx);
    setLoginError(false);
    setActiveModal('loginEdit');
  }, []);

  const handleLoginEdit = () => {
    const user = document.getElementById("loginEditUser")?.value.trim();
    const pass = document.getElementById("loginEditPass")?.value.trim();
    if (user === "admin" && pass === "admin") { // Hardcoded admin login for demo
      setActiveModal('editWO');
      setGlobalMessage('Login admin berhasil.');
      const wo = breakdownData[selectedWoIndex];
      const editNoWO = document.getElementById("editNoWO"); if(editNoWO) editNoWO.value = wo.nowo;
      const editTanggal = document.getElementById("editTanggal"); if(editTanggal) editTanggal.value = wo.tanggal || "";
      const editUnitSelect = document.getElementById("editUnit");
      if (editUnitSelect) {
        editUnitSelect.value = wo.unit || "";
        const event = new Event('change');
        editUnitSelect.dispatchEvent(event);
      }
      const editType = document.getElementById("editType"); if(editType) editType.value = wo.type || "";
      const editJamMulai = document.getElementById("editJamMulai"); if(editJamMulai) editJamMulai.value = wo.jamMulai || "";
      const editJamSelesai = document.getElementById("editJamSelesai"); if(editJamSelesai) editJamSelesai.value = wo.jamSelesai || "";
      const editKomponen = document.getElementById("editKomponen"); if(editKomponen) editKomponen.value = wo.komponen || "";
      const editSubkomponen = document.getElementById("editSubkomponen"); if(editSubkomponen) editSubkomponen.value = wo.subkomponen || "";
      const editDeskripsi = document.getElementById("editDeskripsi"); if(editDeskripsi) editDeskripsi.value = wo.deskripsi || "";
      const editStatusPekerjaan = document.getElementById("editStatusPekerjaan"); if(editStatusPekerjaan) editStatusPekerjaan.value = wo.statusPekerjaan || "";
      const editDescPekerjaan = document.getElementById("editDescPekerjaan"); if(editDescPekerjaan) editDescPekerjaan.value = wo.descPekerjaan || "";

      setManpowerEdit([...(wo.manpowerArr || [])]);
      setMaterialEdit([...(wo.materialArr || [])]);

    } else {
      setLoginError(true);
      setGlobalMessage('Username atau password salah.');
    }
  };

  const handleAddManpowerEdit = () => {
    const input = document.getElementById("editFormManpowerInput");
    let val = input ? input.value.trim() : '';
    if (!val) {
      setGlobalMessage('Manpower tidak boleh kosong.');
      return;
    }
    if (manpowerEdit.includes(val)) {
      setGlobalMessage('Manpower ini sudah ditambahkan.');
      return;
    }
    setManpowerEdit(prev => [...prev, val]);
    addSuggest('manpower', val);
    if (input) input.value = "";
  };

  const handleDeleteManpowerEdit = (idx) => {
    setManpowerEdit(prev => prev.filter((_, i) => i !== idx));
    setGlobalMessage('Manpower dihapus.');
  };

  const handleAddMaterialEdit = () => {
    const materialInput = document.getElementById('editFormMaterialInput');
    const qtyInput = document.getElementById('editInputQty');
    const satuanInput = document.getElementById('editInputSatuan');
    const hargaInput = document.getElementById('editInputHarga');
    const statusMaterialInput = document.getElementById('editInputStatusMaterial');
    const partnoInput = document.getElementById('editInputPartNo');

    const material = materialInput ? materialInput.value.trim() : '';
    const qty = qtyInput ? Number(qtyInput.value) : 0;
    const satuan = satuanInput ? satuanInput.value : '';
    const harga = hargaInput ? parseRupiah(hargaInput.value) : 0;
    const totalHarga = harga * qty;
    const statusMaterial = statusMaterialInput ? statusMaterialInput.value : '';
    const partno = partnoInput ? partnoInput.value.trim() : '';

    if (!material || qty <= 0 || !satuan) {
      setGlobalMessage("Harap isi Sparepart, Qty, dan Satuan dengan benar.");
      return;
    }

    setMaterialEdit(prev => [...prev, { material, qty, satuan, harga, totalHarga, statusMaterial, partno }]);
    addSuggest('material', material);
    if (materialInput) materialInput.value = "";
    if (qtyInput) qtyInput.value = "1";
    if (partnoInput) partnoInput.value = "";
    if (satuanInput) satuanInput.value = "pcs";
    if (hargaInput) hargaInput.value = formatRupiah(0);
    const totalHargaDisplay = document.getElementById('editInputTotalHarga');
    if (totalHargaDisplay) totalHargaDisplay.value = formatRupiah(0);
    if (statusMaterialInput) statusMaterialInput.value = "Terinstal";
    setGlobalMessage('Sparepart ditambahkan.');
  };

  const handleDeleteMaterialEdit = (idx) => {
    setMaterialEdit(prev => prev.filter((_, i) => i !== idx));
    setGlobalMessage('Sparepart dihapus.');
  };

  const updateEditFormTotalHarga = () => {
    const qtyInput = document.getElementById("editInputQty");
    const hargaInput = document.getElementById("editInputHarga");
    const totalHargaOutput = document.getElementById("editInputTotalHarga");

    const qty = Number(qtyInput ? qtyInput.value : "0");
    const harga = parseRupiah(hargaInput ? hargaInput.value : "0");
    if (totalHargaOutput) totalHargaOutput.value = formatRupiah(harga * qty);
  };

  const handleEditWOSubmit = (e) => {
    e.preventDefault();
    if (selectedWoIndex === null) return;

    const fd = new FormData(e.target);
    setBreakdownData(prev => prev.map((wo, idx) => {
      if (idx === selectedWoIndex) {
        const newWo = {
          ...wo,
          tanggal: fd.get("tanggal"),
          unit: fd.get("unit"),
          type: fd.get("type"),
          jamMulai: fd.get("jamMulai"),
          jamSelesai: fd.get("jamSelesai"),
          komponen: fd.get("komponen"),
          subkomponen: fd.get("subkomponen"),
          deskripsi: fd.get("deskripsi"),
          statusPekerjaan: fd.get("statusPekerjaan"),
          descPekerjaan: fd.get("descPekerjaan"),
          manpowerArr: manpowerEdit,
          materialArr: materialEdit,
        };
        if (newWo.jamMulai && newWo.jamSelesai) {
          newWo.durasiMenit = calculateDuration(newWo.jamMulai, newWo.jamSelesai);
        } else {
          newWo.durasiMenit = "";
        }
        if (newWo.status === "RFU" && (!newWo.jamSelesai || !newWo.descPekerjaan)) {
            newWo.status = "OPEN";
        } else if (newWo.jamSelesai && newWo.descPekerjaan && newWo.status !== "RFU") {
            newWo.status = "RFU";
        }

        newWo.manpowerArr.forEach(mp => addSuggest('manpower', mp));
        newWo.materialArr.forEach(m => addSuggest('material', m.material));
        addSuggest('komponen', newWo.komponen);
        addSuggest('subkomponen', newWo.subkomponen);

        return newWo;
      }
      return wo;
    }));

    setActiveModal(null);
    setSelectedWoIndex(null);
    setGlobalMessage(`WO ${breakdownData[selectedWoIndex]?.nowo || ''} berhasil diperbarui.`);
  };

  // --- Delete WO ---
  const handleDeleteWO = useCallback((idx) => {
    const isConfirmed = window.confirm("Apakah Anda yakin ingin menghapus WO ini?");
    if (isConfirmed) {
      setBreakdownData(prev => prev.filter((_, i) => i !== idx));
      setGlobalMessage("WO berhasil dihapus.");
    }
  }, []);

  // --- Export to Excel ---
  const handleExportExcel = () => {
    if (typeof window.XLSX === 'undefined') {
        setGlobalMessage("Pustaka XLSX tidak dimuat. Pastikan Anda telah menyertakan script XLSX dari CDN di index.html.");
        return;
    }

    const dataForExport = breakdownData.map(wo => {
      const manpowerList = (wo.manpowerArr || []).join(', ');
      const materialDetails = (wo.materialArr || []).map(m =>
        `${m.material} (PartNo: ${m.partno || '-'}, Qty: ${m.qty || '-'}, Satuan: ${m.satuan || '-'}, Harga: ${formatRupiah(m.harga)}, Total Harga: ${formatRupiah(m.totalHarga)}, Status: ${m.statusMaterial || '-'})`
      ).join('; ');

      return {
        'No WO': wo.nowo,
        'Tanggal': wo.tanggal,
        'Unit': wo.unit,
        'Type': wo.type,
        'Komponen': wo.komponen,
        'Sub Komponen': wo.subkomponen,
        'Deskripsi Info BD': wo.deskripsi,
        'Jam Mulai': wo.jamMulai,
        'Jam Selesai': wo.jamSelesai,
        'Durasi (menit)': wo.durasiMenit,
        'Status Pekerjaan': wo.statusPekerjaan,
        'Deskripsi Pekerjaan (RFU)': wo.descPekerjaan,
        'Manpower': manpowerList,
        'Sparepart Detail': materialDetails,
        'Status WO': wo.status
      };
    });

    if (dataForExport.length === 0) {
      setGlobalMessage("Tidak ada data untuk diekspor.");
      return;
    }

    const ws = window.XLSX.utils.json_to_sheet(dataForExport);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Work Orders");
    window.XLSX.writeFile(wb, "Work_Orders_Export.xlsx");
    setGlobalMessage("Data berhasil diekspor ke Excel!");
  };

  // Generic handler for right-panel buttons (WO related actions)
  const handleWOAction = (actionName) => {
    if (actionName === 'Form WO') {
      setActiveModal('formWO');
      getNextWoNumber();
    } else if (actionName === 'Export Excel') {
      handleExportExcel();
    }
  };

  // --- Render Functions for Modals ---
  const renderFormWOModal = () => (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000] ${activeModal === 'formWO' ? '' : 'hidden'}`}>
      <div className="bg-[#1a1c28] p-6 rounded-lg shadow-xl w-full max-w-lg text-white">
        <div className="flex justify-between items-center mb-4">
          <h5 className="text-xl font-bold">Form WO</h5>
          <button className="text-gray-400 hover:text-white" onClick={() => setActiveModal(null)}>&times;</button>
        </div>
        <form id="bdForm" onSubmit={handleFormWOSubmit}>
          <div className="mb-3">
            <label className="block text-gray-400 text-sm mb-1">No WO (Otomatis)</label>
            <input type="text" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" value={currentWoNo} readOnly />
          </div>
          <div className="mb-3">
            <label className="block text-gray-400 text-sm mb-1">Tanggal</label>
            <input type="date" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" name="tanggal" required />
          </div>
          <div className="mb-3">
            <label className="block text-gray-400 text-sm mb-1">Unit / CN</label>
            <select className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" name="unit" id="formUnitSelect" required onChange={(e) => {
              const selectedOption = e.target.options[e.target.selectedIndex];
              document.getElementById("formTypeSelect").value = selectedOption.dataset.type || '';
            }}>
              <option value="">--Pilih Unit--</option>
              { (units || []).map(u => u && (u.unit || u.unit_code) && (
                <option key={u.unit || u.unit_code} value={u.unit || u.unit_code} data-type={u.type || ''}>
                  {u.unit || u.unit_code} ({u.type || ''})
                </option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <label className="block text-gray-400 text-sm mb-1">Type Unit</label>
            <input type="text" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" name="type" id="formTypeSelect" readOnly />
          </div>
          <div className="mb-3">
            <label className="block text-gray-400 text-sm mb-1">Jam Mulai Breakdown</label>
            <input type="time" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" name="jamMulai" required />
          </div>
          <div className="mb-3">
            <label className="block text-gray-400 text-sm mb-1">Komponen</label>
            <input type="text" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" name="komponen" id="formKomponenInput" list="komponenSuggest" autoComplete="off" required />
            <datalist id="komponenSuggest">
              {(suggestData.komponen || []).map(val => <option key={val} value={val} />)}
            </datalist>
          </div>
          <div className="mb-3">
            <label className="block text-gray-400 text-sm mb-1">Sub Komponen</label>
            <input type="text" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" name="subkomponen" id="formSubkomponenInput" list="subkomponenSuggest" autoComplete="off" required />
            <datalist id="subkomponenSuggest">
              {(suggestData.subkomponen || []).map(val => <option key={val} value={val} />)}
            </datalist>
          </div>
          <div className="mb-3">
            <label className="block text-gray-400 text-sm mb-1">Info BD</label>
            <input type="text" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" name="deskripsi" required />
          </div>
          <div className="mb-4">
            <label className="block text-gray-400 text-sm mb-1">Status Pekerjaan</label>
            <select className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" name="statusPekerjaan" required>
              <option value="">--Pilih Status--</option>
              <option value="Progres">Progres</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
          <div className="flex justify-end space-x-2">
            <button type="submit" className="bg-[#29a8ff] hover:bg-[#2fc4f9] text-white font-semibold py-2 px-4 rounded-md">Simpan WO</button>
            <button type="button" className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-md" onClick={() => setActiveModal(null)}>Tutup</button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderCloseWOModal = () => (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000] ${activeModal === 'closeWO' ? '' : 'hidden'}`}>
      <div className="bg-[#23243c] p-6 rounded-lg shadow-xl w-full max-w-lg text-white">
        <div className="flex justify-between items-center mb-4">
          <h5 className="text-xl font-bold">Close WO: RFU, Manpower, Material</h5>
          <button className="text-gray-400 hover:text-white" onClick={() => setActiveModal(null)}>&times;</button>
        </div>
        <div className="mb-3">
          <label className="block text-gray-400 text-sm mb-1">Jam Selesai (RFU):</label>
          <input type="time" className="w-full p-2 rounded bg-[#1a1c28] border border-[#313258]" id="inputCloseTime" required />
        </div>
        <div className="mb-3">
          <label className="block text-gray-400 text-sm mb-1">Deskripsi Pekerjaan</label>
          <input type="text" className="w-full p-2 rounded bg-[#1a1c28] border border-[#313258]" id="inputDescPekerjaanClose" placeholder="Uraikan proses/hasil pekerjaan" required />
        </div>
        <div className="mb-4">
          <label className="block text-gray-400 text-sm mb-1">Manpower Terlibat</label>
          <div className="manpower-list flex flex-wrap gap-2 mb-2" id="manpowerListClose">
            {manpowerClose.map((mp, idx) => (
              <span key={idx} className="bg-[#1a1c28] text-sm px-3 py-1 rounded-md flex items-center">
                {mp} <button type="button" className="ml-2 text-red-400 hover:text-red-600" onClick={() => handleDeleteManpowerClose(idx)}>&times;</button>
              </span>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <input type="text" className="flex-1 p-2 rounded bg-[#1a1c28] border border-[#313258]" id="formManpowerInputClose" list="manpowerSuggest" autoComplete="off" />
            <datalist id="manpowerSuggest">
              {(suggestData.manpower || []).map(val => <option key={val} value={val} />)}
            </datalist>
            <button type="button" className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-md" onClick={handleAddManpowerClose}><i className="fa fa-plus"></i></button>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-gray-400 text-sm mb-1">Sparepart</label>
          <div className="material-list flex flex-wrap gap-2 mb-2" id="materialListClose">
            {materialClose.map((mat, idx) => (
              <span key={idx} className="bg-[#1a1c28] text-sm px-3 py-1 rounded-md flex items-center">
                {mat.material} (PartNo: {mat.partno || "-"}, {mat.qty} {mat.satuan}, {formatRupiah(mat.harga)} = {formatRupiah(mat.totalHarga)}, {mat.statusMaterial})
                <button type="button" className="ml-2 text-red-400 hover:text-red-600" onClick={() => handleDeleteMaterialClose(idx)}>&times;</button>
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-7">
            <div className="flex flex-col">
              <label className="text-gray-400 text-sm">Sparepart</label>
              <input type="text" className="p-2 rounded bg-[#1a1c28] border border-[#313258]" id="formMaterialInputClose" list="materialSuggest" />
              <datalist id="materialSuggest">
                {(suggestData.material || []).map(val => <option key={val} value={val} />)}
              </datalist>
            </div>
            <div className="flex flex-col">
              <label className="text-gray-400 text-sm">Part No</label>
              <input type="text" className="p-2 rounded bg-[#1a1c28] border border-[#313258]" id="inputPartNoClose" placeholder="Part No" />
            </div>
            <div className="flex flex-col">
              <label className="text-gray-400 text-sm">Qty</label>
              <input type="number" className="p-2 rounded bg-[#1a1c28] border border-[#313258]" id="inputQtyClose" defaultValue="1" min="1" onChange={updateFormTotalHargaClose} />
            </div>
            <div className="flex flex-col">
              <label className="text-gray-400 text-sm">Satuan</label>
              <select className="p-2 rounded bg-[#1a1c28] border border-[#313258]" id="inputSatuanClose">
                <option value="pcs">pcs</option>
                <option value="set">set</option>
                <option value="unit">unit</option>
                <option value="liter">liter</option>
                <option value="meter">meter</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-gray-400 text-sm">Harga</label>
              <input type="text" className="p-2 rounded bg-[#1a1c28] border border-[#313258]" id="inputHargaClose" defaultValue="0" min="0" placeholder="Rp 0" onInput={updateFormTotalHargaClose} />
            </div>
            <div className="flex flex-col">
              <label className="text-gray-400 text-sm">Total Harga</label>
              <input type="text" className="p-2 rounded bg-[#1a1c28] border border-[#313258]" id="inputTotalHargaClose" defaultValue="0" min="0" placeholder="Rp 0" readOnly />
            </div>
            <div className="flex flex-col">
              <label className="text-gray-400 text-sm">Status Material</label>
              <select className="p-2 rounded bg-[#1a1c28] border border-[#313258]" id="inputStatusMaterialClose">
                <option value="Terinstal">Terinstal</option>
                <option value="Pending Request">Pending Request</option>
                <option value="Tidak Perlu">Tidak Perlu</option>
              </select>
            </div>
            <div className="flex items-center">
              <button type="button" className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-md w-full" onClick={handleAddMaterialClose}><i className="fa fa-plus"></i></button>
            </div>
          </div>
        </div>
        <div className="flex justify-end space-x-2 mt-4">
          <button type="button" className="bg-[#29a8ff] hover:bg-[#2fc4f9] text-white font-semibold py-2 px-4 rounded-md" onClick={handleCloseWOSubmit}>Simpan</button>
        </div>
      </div>
    </div>
  );

  const renderLoginEditModal = () => (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000] ${activeModal === 'loginEdit' ? '' : 'hidden'}`}>
      <div className="bg-[#23243c] p-6 rounded-lg shadow-xl w-full max-w-sm text-white">
        <div className="flex justify-between items-center mb-4">
          <h5 className="text-xl font-bold">Login Admin untuk Edit WO</h5>
          <button className="text-gray-400 hover:text-white" onClick={() => setActiveModal(null)}>&times;</button>
        </div>
        <div className="mb-3">
          <label className="block text-gray-400 text-sm mb-1">Username:</label>
          <input type="text" className="w-full p-2 rounded bg-[#1a1c28] border border-[#313258]" id="loginEditUser" />
        </div>
        <div className="mb-4">
          <label className="block text-gray-400 text-sm mb-1">Password:</label>
          <input type="password" className="w-full p-2 rounded bg-[#1a1c28] border border-[#313258]" id="loginEditPass" />
        </div>
        {loginError && <p className="text-red-500 text-sm mb-4">Username atau password salah.</p>}
        <div className="flex justify-end">
          <button type="button" className="bg-[#29a8ff] hover:bg-[#2fc4f9] text-white font-semibold py-2 px-4 rounded-md" onClick={handleLoginEdit}>Login</button>
        </div>
      </div>
    </div>
  );

  const renderEditWOModal = () => (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000] ${activeModal === 'editWO' ? '' : 'hidden'}`}>
      <div className="bg-[#1a1c28] p-6 rounded-lg shadow-xl w-full max-w-lg text-white">
        <div className="flex justify-between items-center mb-4">
          <h5 className="text-xl font-bold">Edit WO RFU</h5>
          <button className="text-gray-400 hover:text-white" onClick={() => setActiveModal(null)}>&times;</button>
        </div>
        <form id="editFormWO" onSubmit={handleEditWOSubmit}>
          <input type="hidden" id="editIdxWO" value={selectedWoIndex || ''} />
          <div className="mb-3">
            <label className="block text-gray-400 text-sm mb-1">No WO</label>
            <input type="text" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" id="editNoWO" readOnly />
          </div>
          <div className="mb-3">
            <label className="block text-gray-400 text-sm mb-1">Tanggal</label>
            <input type="date" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" name="tanggal" id="editTanggal" required />
          </div>
          <div className="mb-3">
            <label className="block text-gray-400 text-sm mb-1">Unit / CN</label>
            <select className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" name="unit" id="editUnit" required onChange={(e) => {
              const selectedOption = e.target.options[e.target.selectedIndex];
              document.getElementById("editType").value = selectedOption.dataset.type || '';
            }}>
              <option value="">--Pilih Unit--</option>
              { (units || []).map(u => u && (u.unit || u.unit_code) && (
                <option key={u.unit || u.unit_code} value={u.unit || u.unit_code} data-type={u.type || ''}>
                  {u.unit || u.unit_code} ({u.type || ''})
                </option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <label className="block text-gray-400 text-sm mb-1">Type Unit</label>
            <input type="text" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" name="type" id="editType" readOnly />
          </div>
          <div className="mb-3">
            <label className="block text-gray-400 text-sm mb-1">Jam Mulai Breakdown</label>
            <input type="time" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" name="jamMulai" id="editJamMulai" required />
          </div>
          <div className="mb-3">
            <label className="block text-gray-400 text-sm mb-1">Jam Selesai (RFU)</label>
            <input type="time" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" name="jamSelesai" id="editJamSelesai" required />
          </div>
          <div className="mb-3">
            <label className="block text-gray-400 text-sm mb-1">Komponen</label>
            <input type="text" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" name="komponen" id="editKomponen" list="komponenSuggest" autoComplete="off" required />
            <datalist id="komponenSuggest">
              {(suggestData.komponen || []).map(val => <option key={val} value={val} />)}
            </datalist>
          </div>
          <div className="mb-3">
            <label className="block text-gray-400 text-sm mb-1">Sub Komponen</label>
            <input type="text" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" name="subkomponen" id="editSubkomponen" list="subkomponenSuggest" autoComplete="off" required />
            <datalist id="subkomponenSuggest">
              {(suggestData.subkomponen || []).map(val => <option key={val} value={val} />)}
            </datalist>
          </div>
          <div className="mb-3">
            <label className="block text-gray-400 text-sm mb-1">Info BD</label>
            <input type="text" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" name="deskripsi" id="editDeskripsi" required />
          </div>
          <div className="mb-3">
            <label className="block text-gray-400 text-sm mb-1">Status Pekerjaan</label>
            <select className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" name="statusPekerjaan" id="editStatusPekerjaan" required>
              <option value="">--Pilih Status--</option>
              <option value="Progres">Progres</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
          <div className="mb-3">
            <label className="block text-gray-400 text-sm mb-1">Deskripsi Pekerjaan</label>
            <input type="text" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" name="descPekerjaan" id="editDescPekerjaan" required />
          </div>
          <div className="mb-4">
            <label className="block text-gray-400 text-sm mb-1">Manpower Terlibat</label>
            <div className="manpower-list flex flex-wrap gap-2 mb-2" id="editManpowerList">
              {manpowerEdit.map((mp, idx) => (
                <span key={idx} className="bg-[#23243c] text-sm px-3 py-1 rounded-md flex items-center">
                  {mp} <button type="button" className="ml-2 text-red-400 hover:text-red-600" onClick={() => handleDeleteManpowerEdit(idx)}>&times;</button>
                </span>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <input type="text" className="flex-1 p-2 rounded bg-[#23243c] border border-[#313258]" id="editFormManpowerInput" list="manpowerSuggest" autoComplete="off" />
              <datalist id="manpowerSuggest">
                {(suggestData.manpower || []).map(val => <option key={val} value={val} />)}
              </datalist>
              <button type="button" className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-md" onClick={handleAddManpowerEdit}><i className="fa fa-plus"></i></button>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-gray-400 text-sm mb-1">Sparepart</label>
            <div className="material-list flex flex-wrap gap-2 mb-2" id="editMaterialList">
              {materialEdit.map((mat, idx) => (
                <span key={idx} className="bg-[#23243c] text-sm px-3 py-1 rounded-md flex items-center">
                  {mat.material} (PartNo: {mat.partno || "-"}, {mat.qty} {mat.satuan}, {formatRupiah(mat.harga)} = {formatRupiah(mat.totalHarga)}, {mat.statusMaterial})
                  <button type="button" className="ml-2 text-red-400 hover:text-red-600" onClick={() => handleDeleteMaterialEdit(idx)}>&times;</button>
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-7">
              <div className="flex flex-col">
                <label className="text-gray-400 text-sm">Sparepart</label>
                <input type="text" className="p-2 rounded bg-[#23243c] border border-[#313258]" id="editFormMaterialInput" list="materialSuggest" />
                <datalist id="materialSuggest">
                  {(suggestData.material || []).map(val => <option key={val} value={val} />)}
                </datalist>
              </div>
              <div className="flex flex-col">
                <label className="text-gray-400 text-sm">Part No</label>
                <input type="text" className="p-2 rounded bg-[#23243c] border border-[#313258]" id="editInputPartNo" placeholder="Part No" />
            </div>
            <div className="flex flex-col">
              <label className="text-gray-400 text-sm">Qty</label>
              <input type="number" className="p-2 rounded bg-[#23243c] border border-[#313258]" id="editInputQty" defaultValue="1" min="1" onChange={updateEditFormTotalHarga} />
            </div>
            <div className="flex flex-col">
              <label className="text-gray-400 text-sm">Satuan</label>
              <select className="p-2 rounded bg-[#1a1c28] border border-[#313258]" id="editInputSatuan">
                <option value="pcs">pcs</option>
                <option value="set">set</option>
                <option value="unit">unit</option>
                <option value="liter">liter</option>
                <option value="meter">meter</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-gray-400 text-sm">Harga</label>
              <input type="text" className="p-2 rounded bg-[#1a1c28] border border-[#313258]" id="editInputHarga" defaultValue="0" min="0" placeholder="Rp 0" onInput={updateEditFormTotalHarga} />
            </div>
            <div className="flex flex-col">
              <label className="text-gray-400 text-sm">Total Harga</label>
              <input type="text" className="p-2 rounded bg-[#1a1c28] border border-[#313258]" id="editInputTotalHarga" defaultValue="0" min="0" placeholder="Rp 0" readOnly />
            </div>
            <div className="flex flex-col">
              <label className="text-gray-400 text-sm">Status Material</label>
              <select className="p-2 rounded bg-[#1a1c28] border border-[#313258]" id="editInputStatusMaterial">
                <option value="Terinstal">Terinstal</option>
                <option value="Pending Request">Pending Request</option>
                <option value="Tidak Perlu">Tidak Perlu</option>
              </select>
            </div>
            <div className="flex items-center">
              <button type="button" className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-md w-full" onClick={handleAddMaterialEdit}><i className="fa fa-plus"></i></button>
            </div>
          </div>
        </div>
        <div className="flex justify-end space-x-2 mt-4">
          <button type="submit" className="bg-[#29a8ff] hover:bg-[#2fc4f9] text-white font-semibold py-2 px-4 rounded-md">Simpan Perubahan</button>
          <button type="button" className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-md" onClick={() => setActiveModal(null)}>Tutup</button>
        </div>
      </form>
    </div>
  );


  // --- Main Render Structure ---
  return (
    <div className="min-h-screen bg-gray-900 text-white font-montserrat flex">
      {/* Sidebar */}
      <div className="sidebar fixed top-0 left-0 bottom-0 w-56 bg-[#23243c] shadow-xl z-20 transition-all duration-200">
        <div className="brand text-xl font-bold p-5 text-center bg-[#222437]">PLANT</div>
        <ul className="nav flex flex-col mt-4 flex-grow">
          <li><a href="#" className={`nav-link block p-3 px-6 font-semibold rounded-l-lg ${currentPage === 'workOrder' ? 'active bg-[#29a8ff] text-white' : 'text-gray-400 hover:bg-[#2fc4f9] hover:text-white'}`} onClick={() => setCurrentPage('workOrder')}><i className="fa fa-industry mr-2"></i> Work Orders</a></li>
          <li><a href="#" className={`nav-link block p-3 px-6 font-semibold rounded-l-lg ${currentPage === 'spareParts' ? 'active bg-[#29a8ff] text-white' : 'text-gray-400 hover:bg-[#2fc4f9] hover:text-white'}`} onClick={() => setCurrentPage('spareParts')}><i className="fa fa-cogs mr-2"></i> Spare Parts</a></li>
          <li><a href="#" className={`nav-link block p-3 px-6 font-semibold rounded-l-lg ${currentPage === 'production' ? 'active bg-[#29a8ff] text-white' : 'text-gray-400 hover:bg-[#2fc4f9] hover:text-white'}`} onClick={() => setCurrentPage('production')}><i className="fa fa-truck-moving mr-2"></i> Production</a></li>
          <li><a href="#" className={`nav-link block p-3 px-6 font-semibold rounded-l-lg ${currentPage === 'reports' ? 'active bg-[#29a8ff] text-white' : 'text-gray-400 hover:bg-[#2fc4f9] hover:text-white'}`} onClick={() => setCurrentPage('reports')}><i className="fa fa-chart-bar mr-2"></i> Reports</a></li>
          <li><a href="#" className={`nav-link block p-3 px-6 font-semibold rounded-l-lg ${currentPage === 'unitManagement' ? 'active bg-[#29a8ff] text-white' : 'text-gray-400 hover:bg-[#2fc4f9] hover:text-white'}`} onClick={() => setCurrentPage('unitManagement')}><i className="fa fa-truck mr-2"></i> Unit Management</a></li>
        </ul>
        <div className="border-b border-[#313258] mx-4 my-2"></div>
        <div className="p-4 text-[#95a2c7] text-sm">PT Sample Plant System</div>
      </div>

      {/* Main Content Container */}
      <div className="main-container flex-1 ml-56 p-6 transition-all duration-200 flex flex-col">
        {/* Top Header Section (POS-like) */}
        <div className="bg-blue-800 p-4 flex items-center justify-between text-white rounded-t-lg rounded-b-md shadow-lg mb-6">
            <div className="flex items-center">
                <span className="text-2xl font-bold mr-4">PLANT OPS</span>
                <span className="text-lg font-semibold">Sistem Manajemen Operasi Pabrik</span>
            </div>
            <div className="flex items-center space-x-6">
                <div className="text-right">
                    <div className="text-sm">TOTAL BIAYA MAINTENANCE (RFU WO)</div>
                    <div className="text-3xl font-bold">Rp {
                        (breakdownData || []).filter(wo => wo.status === "RFU")
                            .reduce((sum, wo) => sum + (wo.materialArr || []).reduce((matSum, mat) => matSum + mat.totalHarga, 0), 0)
                            .toLocaleString('id-ID')
                    }</div>
                </div>
                {/* Placeholder for other quick info/actions */}
            </div>
        </div>

        {/* Global Message Display */}
        {globalMessage && (
          <div className="fixed top-20 right-6 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-[2000] animate-fade-in-out">
            {globalMessage}
          </div>
        )}

        {/* Content based on currentPage */}
        {(() => {
          switch (currentPage) {
            case 'workOrder':
              return (
                <WorkOrderPage
                  breakdownData={breakdownData} setBreakdownData={setBreakdownData}
                  suggestData={suggestData} addSuggest={addSuggest}
                  currentWoNo={currentWoNo} getNextWoNumber={getNextWoNumber} incrementWoCounter={incrementWoCounter}
                  units={units}
                  openCloseWOModal={openCloseWOModal}
                  openEditWOModal={openEditWOModal}
                  handleDeleteWO={handleDeleteWO}
                  handleExportExcel={handleExportExcel}
                  handleWOAction={handleWOAction} // Pass action handler to sub-component
                  setGlobalMessage={setGlobalMessage}
                  setActiveModal={setActiveModal} // Pass setActiveModal for FormWO
                />
              );
            case 'spareParts':
              return (
                <SparePartCatalogPage
                  sparePartsCatalog={sparePartsCatalog} setSparePartsCatalog={setSparePartsCatalog}
                  setGlobalMessage={setGlobalMessage}
                />
              );
            case 'production':
              return (
                <ProductionPage
                  productionRecords={productionRecords} setProductionRecords={setProductionRecords}
                  units={units}
                  setGlobalMessage={setGlobalMessage}
                />
              );
            case 'reports':
              return (
                <ReportsPage
                  breakdownData={breakdownData}
                  productionRecords={productionRecords}
                  setGlobalMessage={setGlobalMessage}
                />
              );
            case 'unitManagement':
                return (
                    <UnitManagementPage
                        units={units} setUnits={setUnits}
                        setGlobalMessage={setGlobalMessage}
                    />
                );
            default:
              return <div className="p-6 text-xl text-gray-400">Pilih halaman dari sidebar.</div>;
          }
        })()}
      </div>

      {/* Render Modals (kept here because they are global overlays) */}
      {renderFormWOModal()}
      {renderCloseWOModal()}
      {renderLoginEditModal()}
      {renderEditWOModal()}
    </div>
  );
}

// ReactDOM.render() call to mount the App component
ReactDOM.render(<App />, document.getElementById('root'));

// --- Sub-Components ---

// Reusable Action Button Component
function ActionButton({ icon, label, onClick }) { // Changed to function declaration
    return (
        <button
          className="bg-blue-600 text-white p-4 rounded-lg flex flex-col items-center justify-center text-center hover:bg-blue-700 transition duration-300 ease-in-out shadow-md text-sm"
          onClick={onClick}
        >
          <span className="text-4xl mb-1" dangerouslySetInnerHTML={{ __html: icon }}></span>
          <span className="font-semibold">{label}</span>
        </button>
    );
}


function WorkOrderPage({ breakdownData, suggestData, addSuggest, currentWoNo, getNextWoNumber, incrementWoCounter, units, openCloseWOModal, openEditWOModal, handleDeleteWO, handleExportExcel, handleWOAction, setActiveModal, setGlobalMessage }) { // Changed to function declaration
    return (
        <div className="flex flex-col lg:flex-row gap-6 flex-1">
            {/* Left Section - Work Order List */}
            <div className="flex-grow bg-[#222437] rounded-xl shadow-xl p-6 flex flex-col">
                <h2 className="text-2xl font-bold mb-4">Daftar Work Order</h2>

                <div className="section-title text-lg font-semibold text-gray-400 mb-3">OPEN Breakdown</div>
                <div className="overflow-x-auto mb-8 rounded-lg border border-[#313258]">
                    <table className="min-w-full bg-[#222437]">
                        <thead className="bg-[#212234]">
                            <tr>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300 rounded-tl-lg">No</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">No WO</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Tanggal</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Unit</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Type</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Komponen</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Sub Komponen</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Deskripsi</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Jam Mulai</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Status Case</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300 rounded-tr-lg">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(breakdownData || []).filter(wo => wo.status === "OPEN" || wo.statusPekerjaan === "Progres" || wo.statusPekerjaan === "Pending").map((wo, idx) => (
                                <tr key={idx} className="border-b border-[#23243a]">
                                    <td className="py-2 px-4 text-sm">{idx + 1}</td>
                                    <td className="py-2 px-4 text-sm">{wo.nowo}</td>
                                    <td className="py-2 px-4 text-sm">{wo.tanggal}</td>
                                    <td className="py-2 px-4 text-sm">{wo.unit}</td>
                                    <td className="py-2 px-4 text-sm">{wo.type}</td>
                                    <td className="py-2 px-4 text-sm">{wo.komponen}</td>
                                    <td className="py-2 px-4 text-sm">{wo.subkomponen}</td>
                                    <td className="py-2 px-4 text-sm">{wo.deskripsi}</td>
                                    <td className="py-2 px-4 text-sm">{wo.jamMulai}</td>
                                    <td className="py-2 px-4 text-sm">{wo.statusPekerjaan}</td>
                                    <td className="py-2 px-4 text-sm">
                                        <button type="button" className="text-green-500 hover:text-green-300 mr-2" onClick={() => openCloseWOModal(idx)}><i className="fa fa-power-off"></i></button>
                                        <button type="button" className="text-red-500 hover:text-red-300" onClick={() => handleDeleteWO(idx)}><i className="fa fa-trash"></i></button>
                                    </td>
                                </tr>
                            ))}
                            {(breakdownData || []).filter(wo => wo.status === "OPEN" || wo.statusPekerjaan === "Progres" || wo.statusPekerjaan === "Pending").length === 0 && (
                                <tr>
                                    <td colSpan="11" className="py-4 text-center text-gray-500">Tidak ada WO OPEN.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="section-title text-lg font-semibold text-gray-400 mt-8 mb-3">CLOSE Breakdown</div>
                <div className="overflow-x-auto rounded-lg border border-[#313258]">
                    <table className="min-w-full bg-[#222437]">
                        <thead className="bg-[#212234]">
                            <tr>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300 rounded-tl-lg">No</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">No WO</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Tanggal</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Unit</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Type</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Komponen</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Sub Komponen</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Deskripsi</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Jam Mulai</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Jam Selesai</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Durasi (menit)</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Manpower</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Sparepart</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Part No</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Qty</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Status Material Request</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Status BD</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300 rounded-tr-lg">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(breakdownData || []).filter(wo => wo.status === "RFU").map((wo, idx) => (
                                <tr key={idx} className="border-b border-[#23243a]">
                                    <td className="py-2 px-4 text-sm">{idx + 1}</td>
                                    <td className="py-2 px-4 text-sm">{wo.nowo}</td>
                                    <td className="py-2 px-4 text-sm">{wo.tanggal}</td>
                                    <td className="py-2 px-4 text-sm">{wo.unit}</td>
                                    <td className="py-2 px-4 text-sm">{wo.type}</td>
                                    <td className="py-2 px-4 text-sm">{wo.komponen}</td>
                                    <td className="py-2 px-4 text-sm">{wo.subkomponen}</td>
                                    <td className="py-2 px-4 text-sm">{wo.deskripsi}</td>
                                    <td className="py-2 px-4 text-sm">{wo.jamMulai}</td>
                                    <td className="py-2 px-4 text-sm">{wo.jamSelesai}</td>
                                    <td className="py-2 px-4 text-sm">{wo.durasiMenit}</td>
                                    <td className="py-2 px-4 text-sm">{(wo.manpowerArr || []).join(', ')}</td>
                                    <td className="py-2 px-4 text-sm">{(wo.materialArr || []).map(m => m.material).join(', ')}</td>
                                    <td className="py-2 px-4 text-sm">{(wo.materialArr || []).map(m => m.partno || '-').join(', ')}</td>
                                    <td className="py-2 px-4 text-sm">{(wo.materialArr || []).map(m => m.qty || '-').join(', ')}</td>
                                    <td className="py-2 px-4 text-sm">{(wo.materialArr || []).map(m => m.statusMaterial || '-').join(', ')}</td>
                                    <td className="py-2 px-4 text-sm">{wo.status}</td>
                                    <td className="py-2 px-4 text-sm">
                                        <button type="button" className="text-[#29a8ff] hover:text-[#2fc4f9] mr-2" onClick={() => openEditWOModal(idx)}><i className="fa fa-edit"></i></button>
                                        <button type="button" className="text-red-500 hover:text-red-300" onClick={() => handleDeleteWO(idx)}><i className="fa fa-trash"></i></button>
                                    </td>
                                </tr>
                            ))}
                            {(breakdownData || []).filter(wo => wo.status === "RFU").length === 0 && (
                                <tr>
                                    <td colSpan="18" className="py-4 text-center text-gray-500">Tidak ada WO CLOSE.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Right Section - Action Buttons for Work Orders */}
            <div className="lg:w-64 bg-[#222437] rounded-xl shadow-xl p-6 flex flex-col gap-4">
                <ActionButton icon="&#x270D;" label="Form WO" onClick={() => handleWOAction('Form WO')} />
                <ActionButton icon="&#x1F4C4;" label="Export Excel" onClick={() => handleWOAction('Export Excel')} />
            </div>
        </div>
    );
}

// SparePartCatalogPage.js
function SparePartCatalogPage({ sparePartsCatalog, setSparePartsCatalog, setGlobalMessage }) { // Changed to function declaration
    const [newPartNo, setNewPartNo] = useState('');
    const [newPartName, setNewPartName] = useState('');
    const [newUnitPrice, setNewUnitPrice] = useState('');
    const [newUnit, setNewUnit] = useState('pcs');

    const handleAddSparePart = (e) => {
        e.preventDefault();
        if (!newPartNo || !newPartName || !newUnitPrice) {
            setGlobalMessage('Harap isi semua field untuk spare part.');
            return;
        }
        const existing = (sparePartsCatalog || []).find(p => p.partNo === newPartNo);
        if (existing) {
            setGlobalMessage('Part No ini sudah ada di katalog.');
            return;
        }

        const newPart = {
            partNo: newPartNo,
            name: newPartName,
            unitPrice: parseFloat(newUnitPrice),
            unit: newUnit,
            id: String(Date.now()) // Simple unique ID
        };
        setSparePartsCatalog(prev => [...prev, newPart]);
        setGlobalMessage(`Spare part '${newPartName}' ditambahkan.`);
        setNewPartNo('');
        setNewPartName('');
        setNewUnitPrice('');
        setNewUnit('pcs');
    };

    const handleDeleteSparePart = (id) => {
        const isConfirmed = window.confirm("Apakah Anda yakin ingin menghapus spare part ini?");
        if (isConfirmed) {
            setSparePartsCatalog(prev => prev.filter(p => p.id !== id));
            setGlobalMessage("Spare part berhasil dihapus.");
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 flex-1">
            <div className="flex-grow bg-[#222437] rounded-xl shadow-xl p-6 flex flex-col">
                <h2 className="text-2xl font-bold mb-4">Katalog Spare Part</h2>

                <form onSubmit={handleAddSparePart} className="mb-6 p-4 rounded-lg bg-[#1a1c28] border border-[#313258]">
                    <h3 className="text-xl font-semibold mb-3">Tambah Spare Part Baru</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Part No</label>
                            <input type="text" value={newPartNo} onChange={(e) => setNewPartNo(e.target.value)} className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" required />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Nama Part</label>
                            <input type="text" value={newPartName} onChange={(e) => setNewPartName(e.target.value)} className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" required />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Harga Unit</label>
                            <input type="number" value={newUnitPrice} onChange={(e) => setNewUnitPrice(e.target.value)} step="0.01" min="0" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" required />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Satuan</label>
                            <select value={newUnit} onChange={(e) => setNewUnit(e.target.value)} className="w-full p-2 rounded bg-[#23243c] border border-[#313258]">
                                <option value="pcs">pcs</option>
                                <option value="set">set</option>
                                <option value="unit">unit</option>
                                <option value="liter">liter</option>
                                <option value="meter">meter</option>
                                <option value="kg">kg</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md w-full"><i className="fa fa-plus mr-2"></i> Tambah Part</button>
                </form>

                <div className="overflow-x-auto rounded-lg border border-[#313258]">
                    <table className="min-w-full bg-[#222437]">
                        <thead className="bg-[#212234]">
                            <tr>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300 rounded-tl-lg">Part No</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Nama Part</th>
                                <th className="py-2 px-4 text-right text-sm font-semibold text-gray-300">Harga Unit</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Satuan</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300 rounded-tr-lg">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(sparePartsCatalog || []).map(part => (
                                <tr key={part.id} className="border-b border-[#23243a]">
                                    <td className="py-2 px-4 text-sm">{part.partNo}</td>
                                    <td className="py-2 px-4 text-sm">{part.name}</td>
                                    <td className="py-2 px-4 text-right text-sm">{formatRupiah(part.unitPrice)}</td>
                                    <td className="py-2 px-4 text-sm">{part.unit}</td>
                                    <td className="py-2 px-4 text-sm">
                                        <button type="button" className="text-red-500 hover:text-red-300" onClick={() => handleDeleteSparePart(part.id)}><i className="fa fa-trash"></i></button>
                                    </td>
                                </tr>
                            ))}
                            {(sparePartsCatalog || []).length === 0 && (
                                <tr>
                                    <td colSpan="5" className="py-4 text-center text-gray-500">Tidak ada spare part dalam katalog.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Right Section - Action Buttons (perhaps for bulk import/export of spare parts) */}
            <div className="lg:w-64 bg-[#222437] rounded-xl shadow-xl p-6 flex flex-col gap-4">
                <ActionButton icon="&#x1F4BE;" label="Import Parts" onClick={() => setGlobalMessage("Fungsi import spare parts akan datang!")} />
                <ActionButton icon="&#x1F4C4;" label="Export Parts" onClick={() => setGlobalMessage("Fungsi export spare parts akan datang!")} />
            </div>
        </div>
    );
}

// ProductionPage.js
function ProductionPage({ productionRecords, setProductionRecords, units, setGlobalMessage }) { // Changed to function declaration
    const [newProductionUnit, setNewProductionUnit] = useState('');
    const [newProductionType, setNewProductionType] = useState('');
    const [newProductionDate, setNewProductionDate] = useState('');
    const [newProductionShift, setNewProductionShift] = useState('Pagi');
    const [newProductionActivity, setNewProductionActivity] = useState('');
    const [newProductionQuantity, setNewProductionQuantity] = useState('');
    const [newProductionDuration, setNewProductionDuration] = useState('');
    const [newProductionOperator, setNewProductionOperator] = useState('');

    const handleAddProductionRecord = (e) => {
        e.preventDefault();
        if (!newProductionUnit || !newProductionDate || !newProductionActivity || !newProductionQuantity || !newProductionDuration) {
            setGlobalMessage('Harap isi semua field produksi yang wajib.');
            return;
        }

        const unitObj = (units || []).find(u => u.unit_code === newProductionUnit || u.unit === newProductionUnit);

        const newRecord = {
            id: String(Date.now()),
            date: newProductionDate,
            unit: newProductionUnit,
            unitType: unitObj ? unitObj.type : 'N/A',
            shift: newProductionShift,
            activityType: newProductionActivity,
            quantity: parseFloat(newProductionQuantity),
            durationHours: parseFloat(newProductionDuration),
            operator: newProductionOperator,
            estimatedCost: unitObj?.costPerOperationalHour ? parseFloat(newProductionDuration) * unitObj.costPerOperationalHour : 0
        };
        setProductionRecords(prev => [...prev, newRecord]);
        setGlobalMessage(`Catatan produksi untuk ${newProductionUnit} (${newProductionActivity}) ditambahkan.`);
        setNewProductionUnit('');
        setNewProductionType('');
        setNewProductionDate('');
        setNewProductionShift('Pagi');
        setNewProductionActivity('');
        setNewProductionQuantity('');
        setNewProductionDuration('');
        setNewProductionOperator('');
    };

    const handleDeleteProductionRecord = (id) => {
        const isConfirmed = window.confirm("Apakah Anda yakin ingin menghapus catatan produksi ini?");
        if (isConfirmed) {
            setProductionRecords(prev => prev.filter(rec => rec.id !== id));
            setGlobalMessage("Catatan produksi berhasil dihapus.");
        }
    };

    const handleUnitChange = (e) => {
        const selectedUnitCode = e.target.value;
        setNewProductionUnit(selectedUnitCode);
        const selectedUnit = (units || []).find(u => u.unit_code === selectedUnitCode || u.unit === selectedUnitCode);
        setNewProductionType(selectedUnit ? selectedUnit.type : '');
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 flex-1">
            <div className="flex-grow bg-[#222437] rounded-xl shadow-xl p-6 flex flex-col">
                <h2 className="text-2xl font-bold mb-4">Pencatatan Produksi</h2>

                <form onSubmit={handleAddProductionRecord} className="mb-6 p-4 rounded-lg bg-[#1a1c28] border border-[#313258]">
                    <h3 className="text-xl font-semibold mb-3">Tambah Catatan Produksi Baru</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Tanggal</label>
                            <input type="date" value={newProductionDate} onChange={(e) => setNewProductionDate(e.target.value)} className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" required />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Unit / CN</label>
                            <select value={newProductionUnit} onChange={handleUnitChange} className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" required>
                                <option value="">--Pilih Unit--</option>
                                {(units || []).map(u => u && (u.unit || u.unit_code) && (
                                    <option key={u.unit || u.unit_code} value={u.unit || u.unit_code}>
                                        {u.unit || u.unit_code}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Type Unit</label>
                            <input type="text" value={newProductionType} readOnly className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Shift</label>
                            <select value={newProductionShift} onChange={(e) => setNewProductionShift(e.target.value)} className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" required>
                                <option value="Pagi">Pagi</option>
                                <option value="Siang">Siang</option>
                                <option value="Malam">Malam</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Jenis Aktivitas</label>
                            <select value={newProductionActivity} onChange={(e) => setNewProductionActivity(e.target.value)} className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" required>
                                <option value="">--Pilih Aktivitas--</option>
                                <option value="Hauling">Hauling</option>
                                <option value="OB">OB (Overburden)</option>
                                <option value="BB">BB (Broken Blasting)</option>
                                <option value="Loading">Loading</option>
                                <option value="Stockpile">Stockpile</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Kuantitas</label>
                            <input type="number" value={newProductionQuantity} onChange={(e) => setNewProductionQuantity(e.target.value)} min="0" step="0.01" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" required />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Durasi (Jam Operasional)</label>
                            <input type="number" value={newProductionDuration} onChange={(e) => setNewProductionDuration(e.target.value)} min="0" step="0.1" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" required />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Operator</label>
                            <input type="text" value={newProductionOperator} onChange={(e) => setNewProductionOperator(e.target.value)} className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" />
                        </div>
                    </div>
                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md w-full"><i className="fa fa-plus mr-2"></i> Tambah Catatan Produksi</button>
                </form>

                <div className="overflow-x-auto rounded-lg border border-[#313258]">
                    <table className="min-w-full bg-[#222437]">
                        <thead className="bg-[#212234]">
                            <tr>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300 rounded-tl-lg">Tanggal</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Unit (Type)</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Shift</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Aktivitas</th>
                                <th className="py-2 px-4 text-right text-sm font-semibold text-gray-300">Kuantitas</th>
                                <th className="py-2 px-4 text-right text-sm font-semibold text-gray-300">Durasi (Jam)</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Operator</th>
                                <th className="py-2 px-4 text-right text-sm font-semibold text-gray-300">Est. Biaya</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300 rounded-tr-lg">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(productionRecords || []).map(record => (
                                <tr key={record.id} className="border-b border-[#23243a]">
                                    <td className="py-2 px-4 text-sm">{record.date}</td>
                                    <td className="py-2 px-4 text-sm">{record.unit} ({record.unitType})</td>
                                    <td className="py-2 px-4 text-sm">{record.shift}</td>
                                    <td className="py-2 px-4 text-sm">{record.activityType}</td>
                                    <td className="py-2 px-4 text-right text-sm">{record.quantity}</td>
                                    <td className="py-2 px-4 text-right text-sm">{record.durationHours}</td>
                                    <td className="py-2 px-4 text-sm">{record.operator || '-'}</td>
                                    <td className="py-2 px-4 text-right text-sm">{formatRupiah(record.estimatedCost)}</td>
                                    <td className="py-2 px-4 text-sm">
                                        <button type="button" className="text-red-500 hover:text-red-300" onClick={() => handleDeleteProductionRecord(record.id)}><i className="fa fa-trash"></i></button>
                                    </td>
                                </tr>
                            ))}
                            {(productionRecords || []).length === 0 && (
                                <tr>
                                    <td colSpan="9" className="py-4 text-center text-gray-500">Tidak ada catatan produksi.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Right Section - Action Buttons */}
            <div className="lg:w-64 bg-[#222437] rounded-xl shadow-xl p-6 flex flex-col gap-4">
                <ActionButton icon="&#x1F5D1;" label="Export Prod." onClick={() => setGlobalMessage("Fungsi export produksi akan datang!")} />
                <ActionButton icon="&#x1F4C8;" label="View Prod. Trends" onClick={() => setGlobalMessage("Fungsi melihat tren produksi akan datang!")} />
            </div>
        </div>
    );
}

// ReportPage.js
function ReportsPage({ breakdownData, productionRecords, setGlobalMessage }) { // Changed to function declaration
    // Calculate total maintenance costs
    const totalMaintenanceCost = (breakdownData || []).filter(wo => wo.status === "RFU")
        .reduce((sum, wo) => sum + (wo.materialArr || []).reduce((matSum, mat) => matSum + mat.totalHarga, 0), 0);

    // Calculate total production quantity for Hauling, OB, BB
    const totalHauling = (productionRecords || []).filter(rec => rec.activityType === "Hauling")
        .reduce((sum, rec) => sum + rec.quantity, 0);
    const totalOB = (productionRecords || []).filter(rec => rec.activityType === "OB")
        .reduce((sum, rec) => sum + rec.quantity, 0);
    const totalBB = (productionRecords || []).filter(rec => rec.activityType === "BB")
        .reduce((sum, rec) => sum + rec.quantity, 0);
    const totalProductionCost = (productionRecords || []).reduce((sum, rec) => sum + rec.estimatedCost, 0);


    return (
        <div className="flex flex-col lg:flex-row gap-6 flex-1">
            <div className="flex-grow bg-[#222437] rounded-xl shadow-xl p-6 flex flex-col">
                <h2 className="text-2xl font-bold mb-4">Laporan & Analisis</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Maintenance Costs Summary */}
                    <div className="bg-[#1a1c28] p-5 rounded-lg shadow-md border border-[#313258]">
                        <h3 className="text-xl font-semibold mb-3">Biaya Maintenance (Material RFU)</h3>
                        <p className="text-3xl font-bold text-yellow-400">{formatRupiah(totalMaintenanceCost)}</p>
                        <p className="text-sm text-gray-400">Total biaya material dari Work Order yang selesai (RFU).</p>
                    </div>

                    {/* Production Summary */}
                    <div className="bg-[#1a1c28] p-5 rounded-lg shadow-md border border-[#313258]">
                        <h3 className="text-xl font-semibold mb-3">Total Produksi</h3>
                        <p className="text-lg">Hauling: <span className="font-bold">{totalHauling} Ton</span></p>
                        <p className="text-lg">Overburden: <span className="font-bold">{totalOB} BCM</span></p>
                        <p className="text-lg">Broken Blasting: <span className="font-bold">{totalBB} BCM</span></p>
                        <p className="text-md text-gray-400 mt-2">Est. Biaya Produksi: <span className="font-bold">{formatRupiah(totalProductionCost)}</span></p>
                    </div>
                </div>

                <div className="section-title text-lg font-semibold text-gray-400 mt-8 mb-3">Visualisasi (Placeholder)</div>
                <div className="bg-[#1a1c28] p-5 rounded-lg shadow-md border border-[#313258] min-h-[300px] flex items-center justify-center text-gray-500">
                    <p>Grafik dan laporan detail akan ditampilkan di sini.</p>
                </div>
            </div>

            {/* Right Section - Action Buttons for Reports */}
            <div className="lg:w-64 bg-[#222437] rounded-xl shadow-xl p-6 flex flex-col gap-4">
                <ActionButton icon="&#x1F4C5;" label="Laporan Harian" onClick={() => setGlobalMessage("Fungsi laporan harian akan datang!")} />
                <ActionButton icon="&#x1F4CA;" label="Analisis Biaya" onClick={() => setGlobalMessage("Fungsi analisis biaya akan datang!")} />
                <ActionButton icon="&#x1F5BC;" label="Ekspor Laporan" onClick={() => setGlobalMessage("Fungsi ekspor laporan akan datang!")} />
            </div>
        </div>
    );
}

// UnitManagementPage.js
function UnitManagementPage({ units, setUnits, setGlobalMessage }) { // Changed to function declaration
    const [newUnitCode, setNewUnitCode] = useState('');
    const [newUnitType, setNewUnitType] = useState('');
    const [newCostPerHour, setNewCostPerHour] = useState('');

    const handleAddUnit = (e) => {
        e.preventDefault();
        if (!newUnitCode || !newUnitType) {
            setGlobalMessage('Kode unit dan Tipe unit tidak boleh kosong.');
            return;
        }
        const existing = (units || []).find(u => u.unit_code === newUnitCode || u.unit === newUnitCode);
        if (existing) {
            setGlobalMessage('Unit dengan kode ini sudah ada.');
            return;
        }

        const newUnit = {
            unit: newUnitCode,
            unit_code: newUnitCode,
            type: newUnitType,
            costPerOperationalHour: parseFloat(newCostPerHour || '0')
        };
        setUnits(prev => [...prev, newUnit]);
        setGlobalMessage(`Unit '${newUnitCode}' berhasil ditambahkan.`);
        setNewUnitCode('');
        setNewUnitType('');
        setNewCostPerHour('');
    };

    const handleDeleteUnit = (code) => {
        const isConfirmed = window.confirm("Apakah Anda yakin ingin menghapus unit ini?");
        if (isConfirmed) {
            setUnits(prev => prev.filter(u => u.unit_code !== code && u.unit !== code));
            setGlobalMessage("Unit berhasil dihapus.");
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 flex-1">
            <div className="flex-grow bg-[#222437] rounded-xl shadow-xl p-6 flex flex-col">
                <h2 className="text-2xl font-bold mb-4">Manajemen Unit</h2>

                <form onSubmit={handleAddUnit} className="mb-6 p-4 rounded-lg bg-[#1a1c28] border border-[#313258]">
                    <h3 className="text-xl font-semibold mb-3">Tambah Unit Baru</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Kode Unit / CN</label>
                            <input type="text" value={newUnitCode} onChange={(e) => setNewUnitCode(e.target.value)} className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" required />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Tipe Unit</label>
                            <input type="text" value={newUnitType} onChange={(e) => setNewUnitType(e.target.value)} className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" required />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm mb-1">Biaya Per Jam Operasional (Opsional)</label>
                            <input type="number" value={newCostPerHour} onChange={(e) => setNewCostPerHour(e.target.value)} step="0.01" min="0" className="w-full p-2 rounded bg-[#23243c] border border-[#313258]" placeholder="e.g., 50000 (Rp)" />
                        </div>
                    </div>
                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md w-full"><i className="fa fa-plus mr-2"></i> Tambah Unit</button>
                </form>

                <div className="overflow-x-auto rounded-lg border border-[#313258]">
                    <table className="min-w-full bg-[#222437]">
                        <thead className="bg-[#212234]">
                            <tr>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300 rounded-tl-lg">Kode Unit</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300">Tipe Unit</th>
                                <th className="py-2 px-4 text-right text-sm font-semibold text-gray-300">Biaya/Jam Operasional</th>
                                <th className="py-2 px-4 text-left text-sm font-semibold text-gray-300 rounded-tr-lg">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(units || []).map((unit, index) => (
                                <tr key={unit.unit_code || index} className="border-b border-[#23243a]">
                                    <td className="py-2 px-4 text-sm">{unit.unit || unit.unit_code}</td>
                                    <td className="py-2 px-4 text-sm">{unit.type}</td>
                                    <td className="py-2 px-4 text-right text-sm">{formatRupiah(unit.costPerOperationalHour || 0)}</td>
                                    <td className="py-2 px-4 text-sm">
                                        <button type="button" className="text-red-500 hover:text-red-300" onClick={() => handleDeleteUnit(unit.unit_code || unit.unit)}><i className="fa fa-trash"></i></button>
                                    </td>
                                </tr>
                            ))}
                            {(units || []).length === 0 && (
                                <tr>
                                    <td colSpan="4" className="py-4 text-center text-gray-500">Tidak ada unit yang terdaftar.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Right Section - Action Buttons */}
            <div className="lg:w-64 bg-[#222437] rounded-xl shadow-xl p-6 flex flex-col gap-4">
                <ActionButton icon="&#x1F4D1;" label="Edit Unit Data" onClick={() => setGlobalMessage("Fungsi edit data unit akan datang!")} />
                <ActionButton icon="&#x1F4BE;" label="Import Units" onClick={() => setGlobalMessage("Fungsi import unit akan datang!")} />
            </div>
        </div>
    );
}

// Ensure the App is rendered after the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only render if the root element exists
    const rootElement = document.getElementById('root');
    if (rootElement) {
        ReactDOM.render(<App />, rootElement);
    }
});
