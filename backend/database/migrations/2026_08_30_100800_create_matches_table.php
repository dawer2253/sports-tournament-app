<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kształt `Match` jest zamrożony w kontrakcie v0.1; pola drabinkowe opisuje
 * ADR-0004. Bez soft-delete: meczami zarządza generator terminarza i kasuje je
 * kaskadowo, a tombstone'y psułyby najgorętsze zapytanie w aplikacji
 * (tabela liczona on-read przy każdym odświeżeniu strony publicznej).
 *
 * Wewnątrz poddrzewa turnieju żaden klucz obcy nie jest `RESTRICT`. Powód jest
 * mechaniczny: usunięcie turnieju kaskaduje w dół, a InnoDB nie gwarantuje
 * kolejności, w jakiej kasuje rodzeństwo. Jeden `RESTRICT` po drodze zamieniłby
 * kasowanie turnieju w błąd zależny od kolejności wierszy. Zakaz usuwania bytu
 * powiązanego z meczem `finished` żyje w modelach (guard), gdzie widać, co
 * konkretnie blokuje.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('matches', function (Blueprint $table) {
            $table->id();

            $table->foreignId('round_id')->constrained()->cascadeOnDelete();

            // Zdenormalizowane: wynika z `round`, ale „wszystkie zakończone mecze
            // fazy" to najczęstsze zapytanie w systemie (tabela on-read + polling),
            // a tak idzie po indeksie zamiast przez join po `rounds`.
            $table->foreignId('stage_id')->constrained()->cascadeOnDelete();

            $table->foreignId('group_id')->nullable()->constrained()->nullOnDelete();

            // Pozycja własna meczu w rundzie (ADR-0004). W drabince razem
            // z `round.order` wyznacza miejsce w choince, w lidze porządkuje kolejkę.
            $table->unsignedSmallInteger('match_number');

            // Puste, gdy miejsce w drabince nie jest jeszcze rozstrzygnięte.
            // Usunięcie drużyny zeruje slot zamiast kasować mecz — terminarz
            // zachowuje kształt.
            $table->foreignId('home_team_id')->nullable()->constrained('teams')->nullOnDelete();
            $table->foreignId('away_team_id')->nullable()->constrained('teams')->nullOnDelete();

            $table->unsignedSmallInteger('home_score')->nullable();
            $table->unsignedSmallInteger('away_score')->nullable();

            // Rozstrzygają wyłącznie o awansie w drabince przy remisie.
            // Nie są zdobyczami: nie wchodzą do tabeli ani do statystyk.
            $table->unsignedSmallInteger('home_penalties')->nullable();
            $table->unsignedSmallInteger('away_penalties')->nullable();

            $table->enum('status', ['scheduled', 'live', 'finished'])->default('scheduled');
            $table->dateTime('kickoff_at')->nullable();
            $table->foreignId('venue_id')->nullable()->constrained()->nullOnDelete();

            // Propagacja w drabince — dokąd wchodzą uczestnicy tego meczu.
            // Generator zapisuje mecze od finału wstecz, więc cel istnieje już
            // w chwili wstawiania wiersza i nie trzeba drugiego przebiegu.
            $table->unsignedBigInteger('winner_to_match_id')->nullable();
            $table->unsignedBigInteger('loser_to_match_id')->nullable();
            $table->enum('advances_to_slot', ['home', 'away'])->nullable();

            $table->timestamps();

            $table->foreign('winner_to_match_id')->references('id')->on('matches')->nullOnDelete();
            $table->foreign('loser_to_match_id')->references('id')->on('matches')->nullOnDelete();

            // Pozycja własna meczu jest tożsamością, nie danymi — stąd unikat.
            $table->unique(['round_id', 'match_number']);

            // Tabela ligowa i tabele grup, liczone on-read z meczów `finished`.
            $table->index(['stage_id', 'status']);
            $table->index(['group_id', 'status']);

            // Terminarz i wyniki na stronie publicznej, sortowane po dacie.
            $table->index('kickoff_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('matches');
    }
};
