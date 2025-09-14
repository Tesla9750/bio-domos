document.addEventListener('DOMContentLoaded', () => {
    const MOCKAPI_URL = 'https://68c60c19442c663bd0262b0a.mockapi.io/v1';
    const VALOR_RELLENO_AGUA = 1000;
    const alertasTbody = document.getElementById('alertas-tbody');
    const reservasContainer = document.getElementById('reservas-container');

    let dispositivosMap = {};

    const mapearDispositivos = async (domos) => {
        dispositivosMap = {};
        domos.forEach(domo => {
            const irrigadores = (typeof domo.irrigadores === 'string') ? JSON.parse(domo.irrigadores || '[]') : domo.irrigadores || [];
            irrigadores.forEach(disp => {
                dispositivosMap[disp.id_irr] = { nombre: disp.nombre, domo: domo.nombre };
            });
            dispositivosMap[`sistema_agua_${domo.id}`] = { nombre: 'Sistema de Agua', domo: domo.nombre };
        });
    };

    const renderTablaAlertas = (alertas) => {
        alertasTbody.innerHTML = '';
        if (!alertas || alertas.length === 0) {
            alertasTbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay alertas activas en el sistema.</td></tr>';
            return;
        }
        alertas.forEach(alerta => {
            const dispositivoInfo = dispositivosMap[alerta.dispositivoId] || { nombre: 'N/A', domo: '' };
            const nombreCompleto = `${dispositivoInfo.nombre} (${dispositivoInfo.domo})`;
            const fecha = new Date(alerta.timestamp).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' });
            let prioridadBadge = `<span class="badge priority-low">${alerta.prioridad || 'baja'}</span>`;
            if (alerta.prioridad === 'alta') prioridadBadge = `<span class="badge priority-high">${alerta.prioridad}</span>`;
            else if (alerta.prioridad === 'media') prioridadBadge = `<span class="badge priority-medium">${alerta.prioridad}</span>`;
            const fila = `<tr><td>${nombreCompleto}</td><td>${alerta.mensaje}</td><td>${fecha}</td><td>${prioridadBadge}</td></tr>`;
            alertasTbody.innerHTML += fila;
        });
    };

    const renderReservas = (domos) => {
        reservasContainer.innerHTML = '';
        if (!domos || domos.length === 0) return;
        domos.forEach(domo => {
            const reservaCard = `
                <div class="col-md-4">
                    <div class="content-card p-3 text-center">
                        <h5 class="mb-1">${domo.nombre}</h5>
                        <p class="h3 fw-bold text-info">${domo.reservaAgua || 0} L</p>
                        <button class="btn btn-info btn-sm mt-2 btn-rellenar" data-id="${domo.id}">Rellenar Reserva</button>
                    </div>
                </div>
            `;
            reservasContainer.innerHTML += reservaCard;
        });
    };

    const cargarAlertas = async () => {
        try {
            const url = `${MOCKAPI_URL}/eventos?type=alerta&sortBy=timestamp&order=desc&limit=10`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("No se pudieron cargar las alertas.");
            const alertas = await response.json();
            renderTablaAlertas(alertas);
        } catch (error) {
            console.error("Error al cargar alertas:", error);
            alertasTbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${error.message}</td></tr>`;
        }
    };
    
    const simularSistemaGlobal = async () => {
        try {
            const response = await fetch(`${MOCKAPI_URL}/domos`);
            const domos = await response.json();
            await mapearDispositivos(domos);
            renderReservas(domos);

            for (const domo of domos) {
                let domoModificado = false;
                let irrigadores = (typeof domo.irrigadores === 'string') ? JSON.parse(domo.irrigadores || '[]') : domo.irrigadores || [];
                let reservaActual = domo.reservaAgua || 0;

                irrigadores.forEach(irr => {
                    domoModificado = true;
                    if (irr.activo && reservaActual > 0) {
                        irr.humedadSuelo += (Math.random() * 2) + 1; // Sube entre 1% y 3%
                        reservaActual -= 1;
                    } else {
                        // === CAMBIO: Aumentada la velocidad de bajada de humedad ===
                        irr.humedadSuelo -= (Math.random() * 1.5) + 1; // Ahora baja entre 1% y 2.5%
                    }
                    if (irr.humedadSuelo > 100) irr.humedadSuelo = 100;
                    if (irr.humedadSuelo < 0) irr.humedadSuelo = 0;
                    irr.humedadSuelo = Math.round(irr.humedadSuelo);
                    if (irr.humedadSuelo < 55) registrarAlerta(domo.id, irr, `Humedad BAJA: ${irr.humedadSuelo}%.`, 'alta');
                    else if (irr.humedadSuelo > 90) registrarAlerta(domo.id, irr, `Humedad ALTA: ${irr.humedadSuelo}%.`, 'alta');
                });
                
                if (reservaActual < 100 && reservaActual > 0) registrarAlerta(domo.id, {id_irr: `sistema_agua_${domo.id}`}, `Reserva de agua BAJA: ${reservaActual} L.`, 'media');
                if (reservaActual <= 0) {
                    reservaActual = 0;
                    registrarAlerta(domo.id, {id_irr: `sistema_agua_${domo.id}`}, `Reserva de agua AGOTADA.`, 'alta');
                }

                if (domoModificado) {
                    domo.reservaAgua = reservaActual;
                    domo.irrigadores = irrigadores;
                    await fetch(`${MOCKAPI_URL}/domos/${domo.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(domo) });
                }
            }
        } catch (error) { console.error("Error durante la simulación global:", error); }
    };
    
    const rellenarReserva = async (domoId) => {
        try {
            const response = await fetch(`${MOCKAPI_URL}/domos/${domoId}`);
            if (!response.ok) throw new Error('No se pudo encontrar el domo para rellenar.');
            const domo = await response.json();
            domo.reservaAgua = VALOR_RELLENO_AGUA;
            await fetch(`${MOCKAPI_URL}/domos/${domoId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(domo) });
            await registrarAlerta(domoId, {id_irr: `sistema_agua_${domoId}`}, `La reserva de agua ha sido rellenada a ${VALOR_RELLENO_AGUA} L.`, 'media');
            await simularSistemaGlobal();
            await cargarAlertas();
        } catch(error) {
            console.error("Error al rellenar la reserva:", error);
            alert(error.message);
        }
    };
    
    const registrarAlerta = async (domoId, dispositivo, mensaje, prioridad = 'baja') => {
        const evento = { domoId: domoId, dispositivoId: dispositivo.id_irr, type: "alerta", mensaje: mensaje, timestamp: new Date().toISOString(), prioridad: prioridad };
        try {
            await fetch(`${MOCKAPI_URL}/eventos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(evento) });
        } catch (error) { console.error("No se pudo registrar la alerta:", error); }
    };

    const cicloDeRefrescoAlertas = async () => {
        await cargarAlertas();
    };

    reservasContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('btn-rellenar')) {
            const domoId = event.target.dataset.id;
            if (domoId) rellenarReserva(domoId);
        }
    });

    // --- INICIALIZACIÓN ---
    simularSistemaGlobal();
    setInterval(cicloDeRefrescoAlertas, 5000);
    // === CAMBIO: La simulación ahora se ejecuta cada 10 segundos ===
    setInterval(simularSistemaGlobal, 10000); 
});