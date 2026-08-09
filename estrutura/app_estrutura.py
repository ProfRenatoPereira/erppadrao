# estrutura/app_estrutura.py
from flask import Blueprint, request, render_template_string, session, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor

estrutura_blueprint = Blueprint('estrutura_blueprint', __name__)

def obter_conexao_master():
    # Puxa dinamicamente a string do Supabase unificada no app_master
    from app_master import URL_SUPABASE
    return psycopg2.connect(URL_SUPABASE)

@estrutura_blueprint.route('/estrutura')
def pagina_estrutura():
    # Renderiza a estrutura da Página 1
    with open('estrutura/estrutura.html', 'r', encoding='utf-8') as f:
        html = f.read()
    return render_template_string(html)

@estrutura_blueprint.route('/api/estrutura/imoveis', methods=['GET', 'POST'])
def api_imoveis_persist():
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    nome_empresa = session.get('nome_empresa', 'GRUPO DIDÁTICO')
    
    # Inicia a tabela se não existir
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS imoveis_simulacao (
            id SERIAL PRIMARY KEY, equipe_id TEXT, tipo_imovel TEXT, regiao TEXT, 
            area_util REAL, valor_aluguel REAL, valor_condominio REAL, obs_contrato TEXT, nome_grupo TEXT
        )
    ''')

    if request.method == 'POST':
        dados = request.json
        id_reg = dados.get('id')
        valor_aluguel = float(dados.get('valor_aluguel', 0))
        
        if id_reg:
            cursor.execute('''
                UPDATE imoveis_simulacao SET tipo_imovel=%s, regiao=%s, area_util=%s, 
                valor_aluguel=%s, valor_condominio=%s, obs_contrato=%s WHERE id=%s AND equipe_id=%s
            ''', (dados['tipo_imovel'], dados['regiao'], dados['area_util'], valor_aluguel, 
                  dados['valor_condominio'], dados['obs_contrato'], id_reg, id_equipe))
        else:
            cursor.execute('''
                INSERT INTO imoveis_simulacao (equipe_id, tipo_imovel, regiao, area_util, valor_aluguel, valor_condominio, obs_contrato, nome_grupo)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ''', (id_equipe, dados['tipo_imovel'], dados['regiao'], dados['area_util'], valor_aluguel, 
                  dados['valor_condominio'], dados['obs_contrato'], nome_empresa))
                  
        # Atualiza a tabela master de configuração para o cálculo do Custo Fixo em tempo real
        cursor.execute("UPDATE config_simulacao SET valor_aluguel=%s WHERE equipe_id=%s", (valor_aluguel, id_equipe))
            
        conexao.commit()
        cursor.close()
        conexao.close()
        return jsonify({'status': 'sucesso'})
        
    else:
        cursor.execute('SELECT * FROM imoveis_simulacao WHERE equipe_id = %s ORDER BY id DESC', (id_equipe,))
        linhas = cursor.fetchall()
        cursor.close()
        conexao.close()
        return jsonify([dict(linha) for linha in linhas])
@estrutura_blueprint.route('/api/estrutura/imoveis/<int:id_reg>', methods=['GET', 'DELETE'])
def api_individual_imovel(id_reg):
    if not session.get('logado'):
        return jsonify({'status': 'erro', 'message': 'Não autenticado'}), 401
        
    conexao = obter_conexao_master()
    cursor = conexao.cursor(cursor_factory=RealDictCursor)
    id_equipe = session.get('id_equipe', 'equipe_alfa')
    
    if request.method == 'DELETE':
        # Remove do imobiliário e zera o custo fixo de aluguel associado
        cursor.execute('DELETE FROM imoveis_simulacao WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
        cursor.execute("UPDATE config_simulacao SET valor_aluguel=0 WHERE equipe_id=%s", (id_equipe,))
        conexao.commit()
        cursor.close()
        conexao.close()
        return jsonify({'status': 'removido'})
    else:
        cursor.execute('SELECT * FROM imoveis_simulacao WHERE id = %s AND equipe_id = %s', (id_reg, id_equipe))
        imovel = cursor.fetchone()
        cursor.close()
        conexao.close()
        if not imovel: 
            return jsonify({'status': 'erro'}), 404
        return jsonify(dict(imovel))
