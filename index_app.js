document.addEventListener('DOMContentLoaded', () => {
    const MOCKAPI_URL = 'https://68c60c19442c663bd0262b0a.mockapi.io/v1';
    const alertasTbody = document.getElementById('alertas-tbody');

    // Mapa para guardar los nombres de los dispositivos y domos
    let dispositivosMap = {};

    /**
     * Carga todos los domos y crea un mapa de dispositivos para fácil acceso a sus nombres.
     */
    const mapearDispositivos = async () => {
        try {
            const response = await fetch(`${MOCKAPI_URL}/domos`);
            const domos = await response.json();
            
            dispositivosMap = {}; // Limpiar el mapa
            
            domos.forEach(domo => {
                const irrigadores = (typeof domo.irrigadores === 'string') ? JSON.parse(domo.irrigadores || '[]') : domo.irrigadores || [];
                // Aquí podrías añadir luces y ambiente en el futuro
                
                irrigadores.forEach(disp => {
                    dispositivosMap[disp.id_irr] = { nombre: disp.nombre, domo: domo.nombre };
                });
            });
        } catch (error) {
            console.error("Error al mapear dispositivos:", error);
        }
    };

    /**
     * Renderiza la tabla de alertas.
     */
    const renderTablaAlertas = (alertas) => {
        alertasTbody.innerHTML = '';
        if (!alertas || alertas.length === 0) {
            alertasTbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay alertas activas en el sistema.</td></tr>';
            return;
        }

        alertas.forEach(alerta => {
            const dispositivoInfo = dispositivosMap[alerta.dispositivoId] || { nombre: 'Dispositivo Desconocido', domo: '' };
            const nombreCompleto = `${dispositivoInfo.nombre} (${dispositivoInfo.domo})`;
            const fecha = new Date(alerta.timestamp).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' });
            
            let prioridadBadge = `<span class="badge priority-low">${alerta.prioridad || 'baja'}</span>`;
            if (alerta.prioridad === 'alta') {
                prioridadBadge = `<span class="badge priority-high">${alerta.prioridad}</span>`;
            } else if (alerta.prioridad === 'media') {
                prioridadBadge = `<span class="badge priority-medium">${alerta.prioridad}</span>`;
            }

            const fila = `
                <tr>
                    <td>${nombreCompleto}</td>
                    <td>${alerta.mensaje}</td>
                    <td>${fecha}</td>
                    <td>${prioridadBadge}</td>
                </tr>`;
            alertasTbody.innerHTML += fila;
        });
    };

    /**
     * Carga las últimas alertas del sistema.
     */
    const cargarAlertas = async () => {
        try {
            const url = `${MOCKAPI_URL}/eventos?type=alerta&sortBy=timestamp&order=desc`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("No se pudieron cargar las alertas.");
            
            const alertas = await response.json();
            renderTablaAlertas(alertas);

        } catch (error) {
            console.error("Error al cargar alertas:", error);
            alertasTbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${error.message}</td></tr>`;
        }
    };

    /**
     * Función principal que se ejecuta en un intervalo.
     */
    const cicloDeRefresco = async () => {
        await mapearDispositivos(); // Actualizar el mapa de nombres
        await cargarAlertas();    // Cargar las alertas con los nombres actualizados
    };

    // --- INICIALIZACIÓN ---
    cicloDeRefresco(); // Carga inicial inmediata
    setInterval(cicloDeRefresco, 5000); // Refresca cada 5 segundos
});
