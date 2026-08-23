# ==========================================================================
# TERADMAS ERP v2.6 - CENTRAL DE CONSOLIDAÇÃO FINANCEIRA INTER-DEPARTAMENTAL
# CORE UNIFICADO: INSTANCIAÇÃO, MATRIZ CONTÁBIL E ROTAS DE INTEGRAÇÃO
# ==========================================================================

import os
import urllib.parse as urlparse
from flask import Flask, Blueprint, request, session, jsonify, redirect, render_template_string

# Instanciação explícita para o Gunicorn no Render
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'teradmas_secret_key_didatica_2026')

URL_SUPABASE = os.environ.get('URL_SUPABASE')

def obter_conexao_master():
    import psycopg2
    if not URL_SUPABASE:
        raise ValueError("ERRO: A variável de ambiente URL_SUPABASE não está configurada.")
    
    try:
        # Parsing explícito para forçar conexão TCP/IP e mitigar erros de Socket Unix local
        url = urlparse.urlparse(URL_SUPABASE)
        dbname = url.path[1:]
        user = url.username
        password = url.password
        host = url.hostname
        port = url.port or 5432
        
        return psycopg2.connect(
            dbname=dbname,
            user=user,
            password=password,
            host=host,
            port=port,
            sslmode="require"
        )
    except Exception:
        # Fallback de segurança caso a string já esteja sanitizada pelo provedor
        return psycopg2.connect(URL_SUPABASE)

@app.route('/api/financeiro/metricas', methods=['GET'])
def api_metricas_financeiras_globais():
    if not session.get('logado'): 
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    conexao = None
    try:
        conexao = obter_conexao_master()
        from psycopg2.extras import RealDictCursor
        cur = conexao.cursor(cursor_factory=RealDictCursor)
        
        # 1. MÁSCARA ZERO PROGRESSIVA: Garante a estrutura física no banco real do Supabase
        cur.execute('''
            CREATE TABLE IF NOT EXISTS engenharia_processos (
                id SERIAL PRIMARY KEY, 
                equipe_id TEXT, 
                produto_base TEXT, 
                nome_operacao TEXT, 
                maquina_id INTEGER, 
                maquina_nome_suporte TEXT, 
                tempo_setup REAL, 
                tempo_operacao REAL, 
                custo_ref_maquina REAL, 
                sequencia_op INTEGER, 
                custo_total_operacao REAL
            )
        ''')
        conexao.commit()
        
        cur.execute("""
            SELECT COALESCE(SUM(custo_total_operacao), 0) as hist, COALESCE(SUM(custo_ref_maquina), 0) as depr 
            FROM engenharia_processos WHERE equipe_id = %s
        """, (id_equipe,))
        db_data = cur.fetchone()
        
        # Engenharia de custos baseada nas regras de 176h lineares e fator didático 15x
        patrimonio_historico = float(db_data['hist']) * 15.0  
        depreciacao_acumulada = float(db_data['depr']) * 176  
        valor_contabil_liquido = max(0.0, patrimonio_historico - depreciacao_acumulada)
        
        # 2. CUSTOS FIXOS EXPANDIDOS (MOD, Computadores, Utilidades do Laboratório, Softwares e Cursos)
        custo_folha_colaboradores = 18500.00   
        custo_energia_base_infra = 3850.00     
        custo_ti_computadores_engenharia = 2100.00  
        custo_softwares_cadcam = 4200.00       
        custo_capacitacao_viagens = 3120.00    
        
        custo_fixo_setor = (custo_folha_colaboradores + custo_energia_base_infra + 
                            custo_ti_computadores_engenharia + custo_softwares_cadcam + 
                            custo_capacitacao_viagens + depreciacao_acumulada)
        
        custo_fixo_geral_aluguel_planta = 21350.00
        custo_fixo_total_empresa = custo_fixo_geral_aluguel_planta + custo_fixo_setor

        # 3. ALGORITMO PROGRESSIVO DE CUSTOS VARIÁVEIS (Máscara Zero Condicional)
        custo_variavel_setor = float(db_data['hist'])
        custo_variavel_total_empresa = custo_variavel_setor + 5332.10  

        # 4. BLINDAGEM DO TETO DE DIRECIONAMENTO CONTÁBIL (20% Real = R$ 1.000.000,00)
        teto_setor_ativos = 1000000.00
        saldo_disponivel_verba = max(0.0, teto_setor_ativos - patrimonio_historico - custo_fixo_setor)
        
        cur.close()
        conexao.close()
        
        return jsonify({
            "capital_total": 5000000.00,
            "teto_setor_ativos": teto_setor_ativos,
            "saldo_disponivel_verba": saldo_disponivel_verba,
            "patrimonio_historico": patrimonio_historico,
            "valor_contabil_liquido": valor_contabil_liquido,
            "custo_fixo_total": custo_fixo_total_empresa,
            "custo_fixo_departamento": custo_fixo_setor,
            "custo_variavel_total": custo_variavel_total_empresa,
            "custo_variavel_departamento": custo_variavel_setor
        }), 200
        
    except Exception as e:
        if conexao: conexao.close()
        return jsonify({"status": "error", "message": str(e)}), 500

# INTERCEPTAÇÃO VISUAL DIDÁTICA DO ACESSO ESTRETO (LOGIN FALLBACK)
@app.route('/login', methods=['GET', 'POST'])
def rota_login_didatica_fallback():
    if request.method == 'POST':
        session['logado'] = True
        session['id_equipe'] = 'equipe_alfa'
        session['empresa_inicializada'] = True
        return redirect('/processos')
    return render_template_string('''
        <div style="font-family:sans-serif; text-align:center; padding:100px; background:#f3f4f6; height:100vh;">
            <div style="background:white; padding:40px; border-radius:12px; display:inline-block; box-shadow:0 4px 6px rgba(0,0,0,0.05); border-top:4px solid #2563eb;">
                <h2 style="color:#1e3a8a; margin-top:0;">TERADMAS ERP v2.6</h2>
                <p style="color:#64748b; font-size:13px;">Sessão Homologada para Curso Técnico em Administração</p>
                <form method="post"><button type="submit" style="background:#2563eb; color:white; border:none; padding:12px 24px; border-radius:6px; font-weight:bold; cursor:pointer; margin-top:10px;">INICIAR TURNO OPERACIONAL</button></form>
            </div>
        </div>
    ''')

# REGISTRO CLÁSSICO E PROTEGIDO DE BLUEPRINTS
try:
    from processos.app_processos import processos_blueprint
    app.register_blueprint(processos_blueprint)
    print("[TERADMAS LIVE] Módulo de Processos acoplado e online.")
except ImportError:
    try:
        from processos.app_processos import materiais_blueprint
        app.register_blueprint(materiais_blueprint)
        print("[TERADMAS LIVE] Módulo de Processos acoplado via materiais_blueprint legado.")
    except Exception as e:
        print(f"[TERADMAS ERROR] Erro na vinculação local de processos: {e}")

try:
    from maquinas.app_maquinas import maquinas_blueprint
    app.register_blueprint(maquinas_blueprint)
    print("[TERADMAS LIVE] Módulo Máquinas online.")
except Exception: 
    print("[TERADMAS BYPASS] Módulo Máquinas offline ou ausente.")

try:
    from estrutura.app_estrutura import estrutura_blueprint
    app.register_blueprint(estrutura_blueprint)
    print("[TERADMAS LIVE] Módulo Estrutura online.")
except Exception: 
    print("[TERADMAS BYPASS] Módulo Estrutura offline ou ausente.")

if __name__ == '__main__':
    porta = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=porta)
