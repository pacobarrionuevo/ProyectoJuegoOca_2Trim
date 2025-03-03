import { Routes } from '@angular/router';
import { MainComponent } from './pages/main/main.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { MenuComponent } from './pages/menu/menu.component';
import { MatchmakingComponent } from './pages/matchmaking/matchmaking.component';
import { PerfilComponent } from './pages/perfil/perfil.component';
import { GameComponent } from './pages/game/game.component';
import { AdminComponent } from './pages/admin/admin.component';

export const routes: Routes = 
[
    { 
        path: '', 
        component: MainComponent 
    },
    {
        path: 'login',
        component: LoginComponent
    },
    {
        path: 'register',
        component: RegisterComponent
    },
    {
        path: 'menu',
        component: MenuComponent
    },
    {
        path: 'matchmaking',
        component: MatchmakingComponent
    },
    {
        path: 'perfil/:id',
        component: PerfilComponent
    },
    { 
        path: 'game', 
        component: GameComponent 
    },
    {
        path: 'admin',
        component: AdminComponent
    }
];

